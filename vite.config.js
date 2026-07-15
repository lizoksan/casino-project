import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, statSync, readdirSync } from 'fs';
import fg from 'fast-glob';
import { optimize as svgoOptimize } from 'svgo';
import { load as cheerioLoad } from 'cheerio';
import sharp from 'sharp';

// ─── SVG Sprite ───────────────────────────────────────────────────────────────

async function buildSprite() {
	const files = (await fg('src/assets/icons/**/*.svg')).sort();
	let symbols = '';

	for (const file of files) {
		const content = await fs.readFile(file, 'utf-8');

		const result = svgoOptimize(content, {
			plugins: [
				{
					name: 'preset-default',
					params: { overrides: { removeViewBox: false, cleanupIds: false } },
				},
				{
					name: 'removeAttrs',
					params: { attrs: ['svg:width', 'svg:height'] },
				},
			],
		});

		const optimized = result.data;
		const viewBoxMatch = optimized.match(/viewBox="([^"]*)"/i);
		const finalViewBox = viewBoxMatch ? viewBoxMatch[1] : '';
		const inner = optimized.replace(/<svg[\s\S]*?>/, '').replace(/<\/svg>\s*$/, '').trim();

		const id = path.basename(file, '.svg');
		symbols += `<symbol id="${id}"${finalViewBox ? ` viewBox="${finalViewBox}"` : ''}>${inner}</symbol>\n`;
	}

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
		symbols + '</svg>',
	].join('\n');
}

function svgSpritePlugin() {
	let spriteCache = null;

	return {
		name: 'svg-sprite',
		async generateBundle() {
			const sprite = await buildSprite();
			this.emitFile({
				type: 'asset',
				fileName: 'assets/images/sprite.svg',
				source: sprite,
			});
		},
		configureServer(server) {
			server.middlewares.use('/assets/images/sprite.svg', async (_req, res) => {
				if (!spriteCache) spriteCache = await buildSprite();
				res.setHeader('Content-Type', 'image/svg+xml');
				res.end(spriteCache);
			});
			const iconsDir = path.resolve('src/assets/icons');
			server.watcher.add(iconsDir);
			const invalidateSprite = (file) => {
				if (!path.resolve(file).startsWith(iconsDir)) return;
				spriteCache = null;
				server.ws.send({ type: 'full-reload' });
			};
			server.watcher.on('change', invalidateSprite);
			server.watcher.on('add', invalidateSprite);
			server.watcher.on('unlink', invalidateSprite);
		},
	};
}

// ─── WebP <source> tags ────────────────────────────────────────────────────────

function addWebpSources(html) {
	const $ = cheerioLoad(html);
	$('picture').each(function () {
		$(this)
			.find('source:not([type="image/webp"]), img')
			.each(function () {
				const el = $(this);
				const isImg = el.is('img');
				const srcVal = isImg ? el.attr('src') : el.attr('srcset');
				if (!srcVal || !/\.(jpe?g|png)(\?.*)?$/i.test(srcVal)) return;
				const webpSrcset = srcVal
					.split(',')
					.map((part) => {
						const trimmed = part.trim();
						const spaceIdx = trimmed.search(/\s/);
						if (spaceIdx === -1) return trimmed.replace(/\.(jpe?g|png)(\?.*)?$/i, '.webp');
						return (
							trimmed.slice(0, spaceIdx).replace(/\.(jpe?g|png)(\?.*)?$/i, '.webp') +
							trimmed.slice(spaceIdx)
						);
					})
					.join(', ');
				const media = el.attr('media');
				el.before(
					`<source srcset="${webpSrcset}" type="image/webp"${media ? ` media="${media}"` : ''}>`,
				);
			});
	});
	return $.html();
}

function webpSourcePlugin() {
	let outDir;

	return {
		name: 'webp-source',
		apply: 'build',
		configResolved(config) {
			outDir = path.resolve(config.root, config.build.outDir);
		},
		async writeBundle() {
			const htmlFiles = await fg([`${outDir}/**/*.html`]);
			await Promise.all(
				htmlFiles.map(async (htmlPath) => {
					const html = await fs.readFile(htmlPath, 'utf-8');
					await fs.writeFile(htmlPath, addWebpSources(html));
				}),
			);
		},
	};
}

// ─── Image optimization + WebP generation ─────────────────────────────────────

function kb(bytes) {
	return (bytes / 1024).toFixed(1);
}

function dirSize(dir) {
	return readdirSync(dir).reduce((sum, f) => {
		const full = path.join(dir, f);
		return sum + (statSync(full).isDirectory() ? dirSize(full) : statSync(full).size);
	}, 0);
}

function imageOptimizePlugin() {
	let outDir;

	return {
		name: 'image-optimize',
		apply: 'build',
		configResolved(config) {
			outDir = path.resolve(config.root, config.build.outDir);
		},
		async closeBundle() {
			const distAssetsDir = path.join(outDir, 'assets');
			if (!existsSync(distAssetsDir)) return;

			const images = await fg([`${distAssetsDir}/**/*.{jpg,jpeg,png}`]);

			const results = await Promise.all(
				images.map(async (imgPath) => {
					const buffer = await fs.readFile(imgPath);
					const origSize = buffer.length;
					const ext = path.extname(imgPath).slice(1).toLowerCase();

					let optimized;
					if (ext === 'jpg' || ext === 'jpeg') {
						optimized = await sharp(buffer).jpeg({ quality: 90, progressive: true }).toBuffer();
					} else if (ext === 'png') {
						optimized = await sharp(buffer)
							.png({ palette: true, quality: 80, effort: 10 })
							.toBuffer()
							.catch(() => sharp(buffer).png({ compressionLevel: 9 }).toBuffer());
					}

					const final = optimized && optimized.length < buffer.length ? optimized : buffer;
					await fs.writeFile(imgPath, final);

					const webpPath = imgPath.replace(/\.(jpe?g|png)$/i, '.webp');
					await sharp(buffer).webp({ quality: 90 }).toFile(webpPath);

					return { origSize, compSize: final.length };
				}),
			);

			// ─── Build report ──────────────────────────────────────────────────
			const origBytes = results.reduce((s, r) => s + r.origSize, 0);
			const compBytes = results.reduce((s, r) => s + r.compSize, 0);
			const webpCount = results.length;
			const saved = origBytes - compBytes;
			const savedPct = origBytes > 0 ? ((saved / origBytes) * 100).toFixed(1) : 0;

			const spritePath = path.join(outDir, 'assets/images/sprite.svg');
			const spriteSize = existsSync(spritePath) ? statSync(spritePath).size : null;
			const cssPath = path.join(outDir, 'assets/index.css');
			const cssSize = existsSync(cssPath) ? statSync(cssPath).size : null;
			const jsPath = path.join(outDir, 'js/index.js');
			const jsSize = existsSync(jsPath) ? statSync(jsPath).size : null;
			const htmlFiles = readdirSync(outDir).filter((f) => f.endsWith('.html'));
			const htmlSize = htmlFiles.reduce((sum, f) => sum + statSync(path.join(outDir, f)).size, 0);
			const totalSize = dirSize(outDir);

			console.log('\n' + '─'.repeat(44));
			if (images.length > 0) {
				console.log(`  Images   : ${images.length} compressed, ${webpCount} WebP generated`);
				console.log(
					`  Savings  : ${kb(origBytes)} KB → ${kb(compBytes)} KB (−${kb(saved)} KB / ${savedPct}%)`,
				);
			}
			if (spriteSize) console.log(`  Icons    : sprite.svg (${kb(spriteSize)} KB)`);
			console.log(`  HTML     : ${kb(htmlSize)} KB`);
			if (cssSize) console.log(`  CSS      : ${kb(cssSize)} KB`);
			if (jsSize) console.log(`  JS       : ${kb(jsSize)} KB`);
			console.log(`  ${'─'.repeat(40)}`);
			console.log(`  Total    : ${kb(totalSize)} KB`);
			console.log('─'.repeat(44) + '\n');
		},
	};
}

function devWebpPlugin() {
	async function generateWebp(imgPath) {
		const webpPath = imgPath.replace(/\.(jpe?g|png)$/i, '.webp');
		try {
			const [srcStat, webpStat] = await Promise.all([
				fs.stat(imgPath),
				fs.stat(webpPath).catch(() => null),
			]);
			if (webpStat && webpStat.mtimeMs >= srcStat.mtimeMs) return;
			await sharp(imgPath).webp({ quality: 90 }).toFile(webpPath);
		} catch {}
	}

	return {
		name: 'dev-webp',
		apply: 'serve',
		async configureServer(server) {
			const images = await fg('src/assets/images/**/*.{jpg,jpeg,png}');
			await Promise.all(images.map(generateWebp));

			const imagesDir = path.resolve('src/assets/images');
			server.watcher.add(imagesDir);
			const handle = (file) => {
				if (/\.(jpe?g|png)$/i.test(file) && path.resolve(file).startsWith(imagesDir)) {
					generateWebp(file);
				}
			};
			server.watcher.on('add', handle);
			server.watcher.on('change', handle);
		},
	};
}

// ─── Config ────────────────────────────────────────────────────────────────────

export default defineConfig({
	root: 'src',
	base: './',
	publicDir: false,

	build: {
		outDir: '../dist',
		emptyOutDir: true,
		assetsInlineLimit: 0,
		cssMinify: true,
		rollupOptions: {
			output: {
				assetFileNames: 'assets/[name][extname]',
				chunkFileNames: 'js/[name].js',
				entryFileNames: 'js/[name].js',
			},
		},
	},

	css: {
		preprocessorOptions: {
			scss: {
				api: 'modern-compiler',
				loadPaths: [path.resolve('node_modules')],
			},
		},
	},

	plugins: [svgSpritePlugin(), webpSourcePlugin(), imageOptimizePlugin(), devWebpPlugin()],
});
