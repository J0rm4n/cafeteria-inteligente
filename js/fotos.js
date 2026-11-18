// Fotos de los productos: imágenes libres de Wikimedia Commons (se cargan desde sus servidores).
// Cada entrada: [ruta de la miniatura, archivo original, autor, licencia]. Los créditos se ven en #/creditos.
(function () {
  const BASE = "https://upload.wikimedia.org/wikipedia/commons/thumb/";
  const FOTOS = {
    1: ["f/fd/Cup_of_black_coffee.jpg/500px-Cup_of_black_coffee.jpg", "Cup of black coffee.jpg", "ସୁଭ ପା/Subhashish Panigrahi", "CC BY-SA 3.0"],
    2: ["2/21/Double_Espresso_Shot_in_a_Demitasse.jpg/500px-Double_Espresso_Shot_in_a_Demitasse.jpg", "Double Espresso Shot in a Demitasse.jpg", "massage-techniques", "CC BY-SA 2.0"],
    3: ["b/b1/Cappuccino-cup_20230110_104449.jpg/500px-Cappuccino-cup_20230110_104449.jpg", "Cappuccino-cup 20230110 104449.jpg", "Ioacc1234red", "CC BY-SA 4.0"],
    4: ["d/d8/Caffe_Latte_at_Pulse_Cafe.jpg/500px-Caffe_Latte_at_Pulse_Cafe.jpg", "Caffe Latte at Pulse Cafe.jpg", "B adger1", "CC0"],
    5: ["e/e0/Caff%C3%A8_Mocha_by_Phil.jpg/500px-Caff%C3%A8_Mocha_by_Phil.jpg", "Caffè Mocha by Phil.jpg", "Evilphil77", "CC BY 3.0"],
    6: ["6/6d/Cup_of_Hot_Chocolate.jpg/500px-Cup_of_Hot_Chocolate.jpg", "Cup of Hot Chocolate.jpg", "MochaMilk", "CC BY-SA 4.0"],
    7: ["e/e3/Hot_tea._8_minutes_fruit_infusion.jpg/500px-Hot_tea._8_minutes_fruit_infusion.jpg", "Hot tea. 8 minutes fruit infusion.jpg", "Shixart1985", "CC BY 2.0"],
    8: ["7/7a/Frappe_-_coffee_milkshake_with_whipped_cream_and_chocolate_%28KETO%2C_LCHF%2C_Low_Carb%2C_Gluten_free%2C_FIT%29_-_52774791604.jpg/500px-Frappe_-_coffee_milkshake_with_whipped_cream_and_chocolate_%28KETO%2C_LCHF%2C_Low_Carb%2C_Gluten_free%2C_FIT%29_-_52774791604.jpg", "Frappe - coffee milkshake with whipped cream and chocolate (KETO, LCHF, Low Carb, Gluten free, FIT) - 52774791604.jpg", "Ewelina Podrez-Siama", "CC BY 2.0"],
    9: ["1/1e/Iced_Coffee_in_Glass_-_Sunshine_Coffee_-_Laramie_Cafe_%2853838344552%29.jpg/500px-Iced_Coffee_in_Glass_-_Sunshine_Coffee_-_Laramie_Cafe_%2853838344552%29.jpg", "Iced Coffee in Glass - Sunshine Coffee - Laramie Cafe (53838344552).jpg", "Tony Webster", "CC BY 2.0"],
    10: ["9/9a/Glass_of_Mango_Juice.jpg/500px-Glass_of_Mango_Juice.jpg", "Glass of Mango Juice.jpg", "Lisa Pinehill", "CC BY-SA 2.0"],
    11: ["6/69/Limonada_de_coco.jpg/500px-Limonada_de_coco.jpg", "Limonada de coco.jpg", "Caldobasico", "CC BY-SA 4.0"],
    12: ["3/3b/Croissant%2C_whole.jpg/500px-Croissant%2C_whole.jpg", "Croissant, whole.jpg", "SKopp", "CC BY-SA 3.0"],
    13: ["3/34/Pandebono_1_%28comprada_en_la_Panader%C3%ADa_Colombia_Viva%2C_en_Barcelona%2C_Espa%C3%B1a%29.jpg/500px-Pandebono_1_%28comprada_en_la_Panader%C3%ADa_Colombia_Viva%2C_en_Barcelona%2C_Espa%C3%B1a%29.jpg", "Pandebono 1 (comprada en la Panadería Colombia Viva, en Barcelona, España).jpg", "El Mono Español", "CC BY-SA 4.0"],
    14: ["7/73/Pandeyuca%2C_Pandebono_y_Almoj%C3%A1bana._Colombia.JPG/500px-Pandeyuca%2C_Pandebono_y_Almoj%C3%A1bana._Colombia.JPG", "Pandeyuca, Pandebono y Almojábana. Colombia.JPG", "Hoako", "CC BY-SA 3.0"],
    15: ["a/a6/Whole_grain_bread.jpg/500px-Whole_grain_bread.jpg", "Whole grain bread.jpg", "stu_spivack", "CC BY-SA 2.0"],
    16: ["8/8d/Slice_of_chocolate_cake.jpg/500px-Slice_of_chocolate_cake.jpg", "Slice of chocolate cake.jpg", "Ruth Hartnup from Vancouver, Canada", "CC BY 2.0"],
    17: ["a/a9/Passion_fruit_%26_raspberry_cheesecake_-_Jacob%27s_Bakery_%2B_Cafe_2025-10-08.jpg/500px-Passion_fruit_%26_raspberry_cheesecake_-_Jacob%27s_Bakery_%2B_Cafe_2025-10-08.jpg", "Passion fruit & raspberry cheesecake - Jacob's Bakery + Cafe 2025-10-08.jpg", "Andy Li", "CC0"],
    18: ["5/53/Walnut_brownies%2C_October_2010.jpg/500px-Walnut_brownies%2C_October_2010.jpg", "Walnut brownies, October 2010.jpg", "Fabiana Loturco", "CC BY 2.0"],
    19: ["8/82/Oatmeal_cookies_on_a_plate.jpg/500px-Oatmeal_cookies_on_a_plate.jpg", "Oatmeal cookies on a plate.jpg", "Evan Prodromou", "CC0"],
    20: ["0/0a/Chicken_sandwich.jpg/500px-Chicken_sandwich.jpg", "Chicken sandwich.jpg", "Tmannya", "CC BY-SA 3.0"],
    21: ["4/43/Colombian_empanadas_with_aj%C3%AD.jpg/500px-Colombian_empanadas_with_aj%C3%AD.jpg", "Colombian empanadas with ají.jpg", "Huhorihe2", "CC BY-SA 4.0"],
    22: ["c/cc/Vegetable_Wrap_%28toasted%29_-_The_naan_hut_2023-12-22.jpg/500px-Vegetable_Wrap_%28toasted%29_-_The_naan_hut_2023-12-22.jpg", "Vegetable Wrap (toasted) - The naan hut 2023-12-22.jpg", "Andy Li", "CC0"],
    23: ["6/6c/Yogurt%2C_fruit%2C_granola_bowl_%2834999358091%29.jpg/500px-Yogurt%2C_fruit%2C_granola_bowl_%2834999358091%29.jpg", "Yogurt, fruit, granola bowl (34999358091).jpg", "T.Tseng", "CC BY 2.0"],
    24: ["c/ca/Chia_Seed_Pudding_in_a_cup.jpg/500px-Chia_Seed_Pudding_in_a_cup.jpg", "Chia Seed Pudding in a cup.jpg", "Gogerr", "CC BY-SA 4.0"],
    25: ["5/53/A_cup_of_Americano.JPG/500px-A_cup_of_Americano.JPG", "A cup of Americano.JPG", "Airbunny", "CC BY-SA 3.0"],
    26: ["2/2d/Taza_de_caf%C3%A9_con_leche.jpg/500px-Taza_de_caf%C3%A9_con_leche.jpg", "Taza de café con leche.jpg", "Lisa Stevens from Sutton Coldfield, UK", "CC BY-SA 2.0"],
    27: ["c/c9/Espresso_macchiato_Chiang_Mai.JPG/500px-Espresso_macchiato_Chiang_Mai.JPG", "Espresso macchiato Chiang Mai.JPG", "Takeaway", "CC BY-SA 3.0"],
    28: ["0/02/Caramel_Latte_Macchiato.jpg/500px-Caramel_Latte_Macchiato.jpg", "Caramel Latte Macchiato.jpg", "Theactivistuk", "CC BY-SA 4.0"],
    29: ["f/f2/Iced_latte_-_Trading_Post_Coffee_Roasters_2024-06-21.jpg/500px-Iced_latte_-_Trading_Post_Coffee_Roasters_2024-06-21.jpg", "Iced latte - Trading Post Coffee Roasters 2024-06-21.jpg", "Andy Li", "CC0"],
    30: ["a/a2/Espresso_Coffee_Milkshake.jpg/500px-Espresso_Coffee_Milkshake.jpg", "Espresso Coffee Milkshake.jpg", "rick from San Francisco, USA", "CC BY 2.0"],
    31: ["b/b7/Chai_latte_-_Cafe_Coho%2C_Queens_Road%2C_Brighton_2024-03-06.jpg/500px-Chai_latte_-_Cafe_Coho%2C_Queens_Road%2C_Brighton_2024-03-06.jpg", "Chai latte - Cafe Coho, Queens Road, Brighton 2024-03-06.jpg", "Andy Li", "CC0"],
    32: ["a/a1/Agua_Panela_con_Queso_Fresco_at_La_Puerta_Falsa_%285617496209%29.jpg/500px-Agua_Panela_con_Queso_Fresco_at_La_Puerta_Falsa_%285617496209%29.jpg", "Agua Panela con Queso Fresco at La Puerta Falsa (5617496209).jpg", "William Neuheisel from DC, US", "CC BY 2.0"],
    33: ["6/6e/White_cup_with_green_tea_in_it.jpg/500px-White_cup_with_green_tea_in_it.jpg", "White cup with green tea in it.jpg", "Douglas P Perkins", "CC BY 3.0"],
    34: ["9/94/Mint_lemonade.jpg/500px-Mint_lemonade.jpg", "Mint lemonade.jpg", "Bernard Gagnon", "CC BY-SA 3.0"],
    35: ["d/d0/Ml%C3%A9ko_s_rozmixovan%C3%BDmi_ostru%C5%BEinami.jpg/500px-Ml%C3%A9ko_s_rozmixovan%C3%BDmi_ostru%C5%BEinami.jpg", "Mléko s rozmixovanými ostružinami.jpg", "Dezidor", "CC BY 3.0"],
    36: ["6/65/Horchata%2C_my_drink_of_choice_in_Mexico_-_Merida_Yucatan_21_March_2021.jpg/500px-Horchata%2C_my_drink_of_choice_in_Mexico_-_Merida_Yucatan_21_March_2021.jpg", "Horchata, my drink of choice in Mexico - Merida Yucatan 21 March 2021.jpg", "Sharon Hahn Darlin", "CC BY 2.0"],
    37: ["6/68/Strawberry_milk_shake_%28cropped%29.jpg/500px-Strawberry_milk_shake_%28cropped%29.jpg", "Strawberry milk shake (cropped).jpg", "Renee Comet", "Public domain"],
    38: ["c/ce/Green_smoothie_%288222465502%29.jpg/500px-Green_smoothie_%288222465502%29.jpg", "Green smoothie (8222465502).jpg", "Lablascovegmenu from London", "CC BY 2.0"],
    39: ["c/cc/Arepas_con_queso_y_chorizo_01072011.jpg/500px-Arepas_con_queso_y_chorizo_01072011.jpg", "Arepas con queso y chorizo 01072011.jpg", "Dtarazona", "CC BY-SA 3.0"],
    40: ["6/6d/Arepa_perico.jpg/500px-Arepa_perico.jpg", "Arepa perico.jpg", "Pequeño mar", "CC BY-SA 4.0"],
    41: ["2/20/French_toast_with_berries_and_maple_syrup_-_Pasadena%2C_CA.jpg/500px-French_toast_with_berries_and_maple_syrup_-_Pasadena%2C_CA.jpg", "French toast with berries and maple syrup - Pasadena, CA.jpg", "Daderot", "CC0"],
    42: ["5/56/Pandeyuca-colombiano.jpg/500px-Pandeyuca-colombiano.jpg", "Pandeyuca-colombiano.jpg", "Ahoraes", "CC BY-SA 4.0"],
    43: ["2/21/Bu%C3%B1uelos_Colombianos_%2824221303805%29.jpg/500px-Bu%C3%B1uelos_Colombianos_%2824221303805%29.jpg", "Buñuelos Colombianos (24221303805).jpg", "John Alexis Guerra Gómez", "CC BY-SA 2.0"],
    44: ["d/df/Rosca_de_Reyes%2C_casera%2C_M%C3%A9xico_03.jpg/500px-Rosca_de_Reyes%2C_casera%2C_M%C3%A9xico_03.jpg", "Rosca de Reyes, casera, México 03.jpg", "Petrvs III", "CC BY-SA 4.0"],
    45: ["e/e4/Ham_and_cheese_sandwich.jpg/500px-Ham_and_cheese_sandwich.jpg", "Ham and cheese sandwich.jpg", "jeffreyw", "CC BY 2.0"],
    46: ["7/71/Ham_and_cheese_croissant_-_Massachusetts.jpg/500px-Ham_and_cheese_croissant_-_Massachusetts.jpg", "Ham and cheese croissant - Massachusetts.jpg", "Daderot", "CC0"],
    47: ["e/e3/Panini_mozzarella_at_Down_The_Rabbit_Hole_2018.jpg/500px-Panini_mozzarella_at_Down_The_Rabbit_Hole_2018.jpg", "Panini mozzarella at Down The Rabbit Hole 2018.jpg", "FakirNL", "CC BY-SA 4.0"],
    48: ["d/da/Teque%C3%B1os_fritos.jpg/500px-Teque%C3%B1os_fritos.jpg", "Tequeños fritos.jpg", "Muago", "CC0"],
    49: ["a/ad/DFC_2103_Golden_flaky_croissant_pockets_filled_with_creamy_chicken_and_corn_finished_with_a_sprig_of_parsley.jpg/500px-DFC_2103_Golden_flaky_croissant_pockets_filled_with_creamy_chicken_and_corn_finished_with_a_sprig_of_parsley.jpg", "DFC 2103 Golden flaky croissant pockets filled with creamy chicken and corn finished with a sprig of parsley.jpg", "PattayaPatrol", "CC BY-SA 4.0"],
    50: ["c/ca/Tres_leches_cake.jpg/500px-Tres_leches_cake.jpg", "Tres leches cake.jpg", "Autor no indicado", "CC BY-SA 2.0"],
    51: ["7/78/Obleas_en_Comuna_13.jpg/500px-Obleas_en_Comuna_13.jpg", "Obleas en Comuna 13.jpg", "Xemenendura", "CC BY-SA 4.0"],
    52: ["1/19/Affogato.JPG/500px-Affogato.JPG", "Affogato.JPG", "VR38DETT", "Public domain"],
    53: ["6/61/Blueberry_Almond_Yogurt_Bowl.jpg/500px-Blueberry_Almond_Yogurt_Bowl.jpg", "Blueberry Almond Yogurt Bowl.jpg", "Sannidhishetty", "CC BY-SA 4.0"],
    54: ["4/4a/Avocado_toast.jpg/500px-Avocado_toast.jpg", "Avocado toast.jpg", "Pequeño mar", "CC BY-SA 4.0"]
  };
  const LICENCIAS = {
    "CC0": "https://creativecommons.org/publicdomain/zero/1.0/deed.es",
    "Public domain": "https://es.wikipedia.org/wiki/Dominio_p%C3%BAblico",
    "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/deed.es",
    "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/deed.es",
    "CC BY-SA 2.0": "https://creativecommons.org/licenses/by-sa/2.0/deed.es",
    "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/deed.es",
    "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/deed.es"
  };
  window.fotos = {
    url: (id) => FOTOS[id] ? BASE + FOTOS[id][0] : null,
    creditos: () => Object.entries(FOTOS).map(([id, [, archivo, autor, licencia]]) => ({
      id: Number(id), archivo, autor, licencia, licenciaUrl: LICENCIAS[licencia] || null,
      fuente: "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(archivo.replace(/ /g, "_"))
    }))
  };
})();
