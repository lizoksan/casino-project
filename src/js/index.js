import Swiper from 'swiper';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

const SELECTORS = {
	questsSwiper: '.quests__swiper',
	questsButtonNext: '.quests__button--next',
	questsButtonPrev: '.quests__button--prev',
};

document.addEventListener('DOMContentLoaded', () => {
	const swiper = new Swiper(SELECTORS.questsSwiper, {
		modules: [Navigation],

		spaceBetween: 250,
		loop: true,

		navigation: {
			nextEl: SELECTORS.questsButtonNext,
			prevEl: SELECTORS.questsButtonPrev,
		},

		breakpoints: {
			1024: {
				enabled: false,
				slidesPerView: 3,
				spaceBetween: 79,
			},
		},
	});
});
