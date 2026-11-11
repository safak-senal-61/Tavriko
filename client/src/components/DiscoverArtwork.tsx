import { ImageSourcePropType } from 'react-native';

/**
 * Keşfet ekranı için üretilmiş 3B kategori görselleri.
 * Stil: parlak 3D oyun ikonu, altın kenar, şeffaf zemin (Tavriko UI Kit).
 * Kaynak dosyalar: client/assets/images/discovery/cat_*.png
 */
export const DISCOVER_CATEGORY_IMG: Record<string, ImageSourcePropType> = {
  gaming_videogames: require('../../assets/images/discovery/cat_gaming.png'),
  anime_manga: require('../../assets/images/discovery/cat_anime.png'),
  cartoons_animation: require('../../assets/images/discovery/cat_cartoons.png'),
  cinema_tv: require('../../assets/images/discovery/cat_cinema.png'),
  comics_superheroes: require('../../assets/images/discovery/cat_comics.png'),
  fantasy_fiction: require('../../assets/images/discovery/cat_fantasy.png'),
  social_internet: require('../../assets/images/discovery/cat_social.png'),
  history: require('../../assets/images/discovery/cat_history.png'),
  mythology_ancient: require('../../assets/images/discovery/cat_mythology.png'),
  turkey_special: require('../../assets/images/discovery/cat_turkey.png'),
  art_culture: require('../../assets/images/discovery/cat_art.png'),
  literature: require('../../assets/images/discovery/cat_literature.png'),
  science_tech: require('../../assets/images/discovery/cat_science.png'),
  space_astronomy: require('../../assets/images/discovery/cat_space.png'),
  biology: require('../../assets/images/discovery/cat_biology.png'),
  physics_chemistry: require('../../assets/images/discovery/cat_physics.png'),
  nature_ecology: require('../../assets/images/discovery/cat_nature.png'),
  animals_wildlife: require('../../assets/images/discovery/cat_animals.png'),
  mathematics: require('../../assets/images/discovery/cat_math.png'),
  music: require('../../assets/images/discovery/cat_music.png'),
  sports: require('../../assets/images/discovery/cat_sports.png'),
  food_gastronomy: require('../../assets/images/discovery/cat_food.png'),
  hobbies_leisure: require('../../assets/images/discovery/cat_hobbies.png'),
  daily_life: require('../../assets/images/discovery/cat_daily.png'),
  logic_puzzles: require('../../assets/images/discovery/cat_logic.png'),
  language_vocab: require('../../assets/images/discovery/cat_language.png'),
  geography: require('../../assets/images/discovery/cat_geography.png'),
  general_culture: require('../../assets/images/discovery/cat_general.png'),
};

/** Keşfet başlığının geniş portal görseli (şeffaf zemin, 16:9). */
export const HERO_DISCOVER_IMG: ImageSourcePropType = require(
  '../../assets/images/discovery/hero_discover.png'
);
