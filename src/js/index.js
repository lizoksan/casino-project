import Swiper from 'swiper';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

const SELECTORS = {};

const CLASSNAMES = {};

document.addEventListener('DOMContentLoaded', () => {
	const swiper = new Swiper('.quests__swiper', {
		modules: [Navigation],

		spaceBetween: 89,
		loop: true,

		navigation: {
			nextEl: '.quests__button--next',
			prevEl: '.quests__button--prev',
		},
	});
});
