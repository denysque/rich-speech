#!/usr/bin/env python3
"""
Валидирует кандидатов через curl HEAD к Wikimedia Special:FilePath
с задержкой между запросами (чтобы не словить 429), оставляет только
файлы с HTTP 200 и записывает в src/data/paintings.json.

Запускать: python3 scripts/build_paintings.py
"""
import json
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

CANDIDATES = [
    # === Renaissance Italian ===
    ("mona-lisa",            "Мона Лиза",                       "Леонардо да Винчи",        "ок. 1503", "Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg"),
    ("last-supper",          "Тайная вечеря",                   "Леонардо да Винчи",        "1495-1498", "Última_Cena_-_Da_Vinci_5.jpg"),
    ("lady-ermine",          "Дама с горностаем",               "Леонардо да Винчи",        "1489-1491", "Dama_z_gronostajem.jpg"),
    ("vitruvian-man",        "Витрувианский человек",           "Леонардо да Винчи",        "ок. 1490", "Da_Vinci_Vitruve_Luc_Viatour.jpg"),
    ("creation-of-adam",     "Сотворение Адама",                "Микеланджело",             "1512", "Michelangelo_-_Creation_of_Adam_(cropped).jpg"),
    ("school-of-athens",     "Афинская школа",                  "Рафаэль",                   "1509-1511", "\"The_School_of_Athens\"_by_Raffaello_Sanzio_da_Urbino.jpg"),
    ("sistine-madonna",      "Сикстинская мадонна",             "Рафаэль",                   "1512", "RAFAEL_-_Madonna_Sixtina_(Gemäldegalerie_Alter_Meister,_Dresde,_1513-14._Óleo_sobre_lienzo,_265_x_196_cm).jpg"),
    ("birth-of-venus",       "Рождение Венеры",                 "Сандро Боттичелли",        "ок. 1485", "Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg"),
    ("primavera",            "Весна",                            "Сандро Боттичелли",        "ок. 1482", "Botticelli-primavera.jpg"),
    ("the-tempest",          "Гроза",                           "Джорджоне",                 "ок. 1508", "Giorgione_019.jpg"),
    ("venus-of-urbino",      "Венера Урбинская",                "Тициан",                    "1538", "Tiziano_-_Venere_di_Urbino_-_Google_Art_Project.jpg"),

    # === Renaissance Northern ===
    ("garden-earthly",       "Сад земных наслаждений",          "Иероним Босх",             "ок. 1500", "The_Garden_of_earthly_delights.jpg"),
    ("arnolfini-portrait",   "Портрет четы Арнольфини",         "Ян ван Эйк",                "1434", "Van_Eyck_-_Arnolfini_Portrait.jpg"),
    ("ghent-altarpiece",     "Гентский алтарь",                 "Ян ван Эйк",                "1432", "Lamgods_open.jpg"),
    ("hunters-in-snow",      "Охотники на снегу",               "Питер Брейгель",            "1565", "Pieter_Bruegel_the_Elder_-_Hunters_in_the_Snow_(Winter)_-_Google_Art_Project.jpg"),
    ("tower-of-babel",       "Вавилонская башня",               "Питер Брейгель",            "1563", "Pieter_Bruegel_the_Elder_-_The_Tower_of_Babel_(Vienna)_-_Google_Art_Project_-_edited.jpg"),

    # === Baroque ===
    ("night-watch",          "Ночной дозор",                    "Рембрандт",                "1642", "The_Nightwatch_by_Rembrandt.jpg"),
    ("anatomy-tulp",         "Урок анатомии доктора Тульпа",    "Рембрандт",                "1632", "Rembrandt_-_The_Anatomy_Lesson_of_Dr_Nicolaes_Tulp.jpg"),
    ("return-prodigal",      "Возвращение блудного сына",       "Рембрандт",                "1668", "Rembrandt_Harmensz_van_Rijn_-_Return_of_the_Prodigal_Son_-_Google_Art_Project.jpg"),
    ("pearl-earring",        "Девушка с жемчужной серёжкой",    "Ян Вермеер",                "ок. 1665", "1665_Girl_with_a_Pearl_Earring.jpg"),
    ("milkmaid",             "Молочница",                        "Ян Вермеер",                "ок. 1660", "Johannes_Vermeer_-_Het_melkmeisje_-_Google_Art_Project.jpg"),
    ("las-meninas",          "Менины",                           "Диего Веласкес",            "1656", "Las_Meninas,_by_Diego_Velázquez,_from_Prado_in_Google_Earth.jpg"),
    ("calling-matthew",      "Призвание апостола Матфея",       "Караваджо",                 "1600", "The_Calling_of_Saint_Matthew-Caravaggo_(1599-1600).jpg"),
    ("judith-holofernes",    "Юдифь и Олоферн",                 "Караваджо",                 "1599", "Caravaggio_-_Giuditta_e_Oloferne_(ca._1599).jpg"),

    # === Romanticism ===
    ("raft-of-medusa",       "Плот «Медузы»",                   "Теодор Жерико",             "1819", "JEAN_LOUIS_THÉODORE_GÉRICAULT_-_La_Balsa_de_la_Medusa_(Museo_del_Louvre,_1818-19).jpg"),
    ("liberty-leading",      "Свобода, ведущая народ",          "Эжен Делакруа",             "1830", "Eugène_Delacroix_-_Le_28_Juillet._La_Liberté_guidant_le_peuple.jpg"),
    ("wanderer-fog",         "Странник над морем тумана",       "Каспар Давид Фридрих",      "1818", "Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg"),
    ("third-of-may",         "Третье мая 1808 года",            "Франсиско Гойя",            "1814", "El_Tres_de_Mayo,_by_Francisco_de_Goya,_from_Prado_thin_black_margin.jpg"),
    ("saturn-devouring",     "Сатурн, пожирающий своего сына",  "Франсиско Гойя",            "1819-1823", "Francisco_de_Goya,_Saturno_devorando_a_su_hijo_(1819-1823).jpg"),
    ("fighting-temeraire",   "Последний рейс корабля «Отважный»","Уильям Тёрнер",            "1839", "Turner,_J._M._W._-_The_Fighting_Téméraire_tugged_to_her_last_Berth_to_be_broken.jpg"),
    ("ninth-wave",           "Девятый вал",                     "Иван Айвазовский",          "1850", "Hovhannes_Aivazovsky_-_The_Ninth_Wave_-_Google_Art_Project.jpg"),

    # === Realism ===
    ("gleaners",             "Сборщицы колосьев",               "Жан-Франсуа Милле",         "1857", "Jean-François_Millet_-_Gleaners_-_Google_Art_Project_2.jpg"),
    ("angelus",              "Анжелюс",                          "Жан-Франсуа Милле",         "1859", "JEAN-FRANÇOIS_MILLET_-_El_Ángelus_(Museo_de_Orsay,_1857-1859._Óleo_sobre_lienzo,_55.5_x_66_cm).jpg"),
    ("origin-of-world",      "Происхождение мира",              "Гюстав Курбе",              "1866", "Origin-of-the-World.jpg"),
    ("olympia",              "Олимпия",                          "Эдуард Мане",               "1863", "Edouard_Manet_-_Olympia_-_Google_Art_Project_3.jpg"),
    ("luncheon-grass",       "Завтрак на траве",                "Эдуард Мане",               "1863", "Edouard_Manet_-_Luncheon_on_the_Grass_-_Google_Art_Project.jpg"),
    ("bar-folies",           "Бар «Фоли-Бержер»",               "Эдуард Мане",               "1882", "Edouard_Manet,_A_Bar_at_the_Folies-Bergère.jpg"),

    # === Impressionism ===
    ("impression-sunrise",   "Впечатление. Восходящее солнце",  "Клод Моне",                 "1872", "Monet_-_Impression,_Sunrise.jpg"),
    ("water-lilies-pond",    "Пруд с водяными лилиями",         "Клод Моне",                 "1899", "Water-Lilies-and-Japanese-Bridge-(1897-1899)-Monet.jpg"),
    ("haystacks-monet",      "Стога сена",                      "Клод Моне",                 "1890", "Monet_-_Haystacks,_1890-91,_D.1966-0001.jpg"),
    ("rouen-cathedral",      "Руанский собор",                  "Клод Моне",                 "1894", "Claude_Monet_-_Rouen_Cathedral,_Facade_(Sunset).JPG"),
    ("bal-du-moulin",        "Бал в Мулен де ла Галетт",        "Огюст Ренуар",              "1876", "Auguste_Renoir_-_Dance_at_Le_Moulin_de_la_Galette_-_Musée_d'Orsay_RF_2739_(derivative_work_-_AutoContrast_edit_in_LCH_space).jpg"),
    ("luncheon-boating",     "Завтрак гребцов",                 "Огюст Ренуар",              "1881", "Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg"),
    ("absinthe-degas",       "Абсент",                           "Эдгар Дега",                "1876", "Edgar_Degas_-_In_a_Café_-_Google_Art_Project_2.jpg"),
    ("ballet-rehearsal",     "Репетиция балета",                "Эдгар Дега",                "1874", "Edgar_Degas_-_The_Ballet_Class_-_Google_Art_Project.jpg"),
    ("paris-rainy",          "Улица Парижа в дождливый день",   "Гюстав Кайботт",            "1877", "Gustave_Caillebotte_-_Paris_Street;_Rainy_Day_-_Google_Art_Project.jpg"),

    # === Post-Impressionism ===
    ("starry-night",         "Звёздная ночь",                   "Винсент Ван Гог",           "1889", "Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg"),
    ("sunflowers",           "Подсолнухи",                      "Винсент Ван Гог",           "1888", "Vincent_Willem_van_Gogh_127.jpg"),
    ("self-portrait-vg",     "Автопортрет",                      "Винсент Ван Гог",           "1889", "Vincent_van_Gogh_-_Self-Portrait_-_Google_Art_Project.jpg"),
    ("bedroom-arles",        "Спальня в Арле",                  "Винсент Ван Гог",           "1888", "Vincent_van_Gogh_-_De_slaapkamer_-_Google_Art_Project.jpg"),
    ("cafe-terrace",         "Ночная терраса кафе",             "Винсент Ван Гог",           "1888", "Vincent_Willem_van_Gogh_-_Cafe_Terrace_at_Night_(Yorck).jpg"),
    ("wheatfield-crows",     "Пшеничное поле с воронами",       "Винсент Ван Гог",           "1890", "Vincent_van_Gogh_-_Wheatfield_with_crows_-_Google_Art_Project.jpg"),
    ("mont-sainte-victoire", "Гора Сент-Виктуар",               "Поль Сезанн",               "1904", "Paul_Cézanne_108.jpg"),
    ("where-do-we-come",     "Откуда мы? Кто мы? Куда мы идём?","Поль Гоген",                "1897", "Paul_Gauguin_-_D'ou_venons-nous.jpg"),
    ("yellow-christ",        "Жёлтый Христос",                  "Поль Гоген",                "1889", "Gauguin_Il_Cristo_giallo.jpg"),
    ("sunday-grande-jatte",  "Воскресенье на острове Гранд-Жатт","Жорж Сёра",                "1886", "A_Sunday_on_La_Grande_Jatte,_Georges_Seurat,_1884.jpg"),

    # === Symbolism / Expressionism / Modern ===
    ("the-scream",           "Крик",                            "Эдвард Мунк",               "1893", "Edvard_Munch,_1893,_The_Scream,_oil,_tempera_and_pastel_on_cardboard,_91_x_73_cm,_National_Gallery_of_Norway.jpg"),
    ("madonna-munch",        "Мадонна",                          "Эдвард Мунк",               "1894", "Edvard_Munch_-_Madonna_(1894-1895).jpg"),
    ("the-kiss",             "Поцелуй",                         "Густав Климт",              "1908", "The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg"),
    ("judith-klimt",         "Юдифь и голова Олоферна",         "Густав Климт",              "1901", "Gustav_Klimt_039.jpg"),
    ("isle-of-dead",         "Остров мёртвых",                  "Арнольд Бёклин",            "1883", "Arnold_Böcklin_-_Die_Toteninsel_III_(Alte_Nationalgalerie,_Berlin).jpg"),
    ("composition-vii",      "Композиция VII",                  "Василий Кандинский",        "1913", "Vassily_Kandinsky,_1913_-_Composition_7.jpg"),
    ("composition-viii",     "Композиция VIII",                 "Василий Кандинский",        "1923", "Vassily_Kandinsky,_1923_-_Composition_8,_huile_sur_toile,_140_cm_x_201_cm,_Musée_Guggenheim,_New_York.jpg"),
    ("the-dance",            "Танец",                           "Анри Матисс",               "1910", "La_danse_(I)_by_Matisse.jpg"),
    ("the-cry-redon",        "Циклоп",                           "Одилон Редон",              "1914", "Odilon_Redon_-_The_Cyclops,_c._1914.jpg"),

    # === Abstract (early) ===
    ("black-square",         "Чёрный квадрат",                  "Казимир Малевич",           "1915", "Kazimir_Malevich,_1915,_Black_Suprematic_Square,_oil_on_linen_canvas,_79.5_x_79.5_cm,_Tretyakov_Gallery,_Moscow.jpg"),
    ("white-on-white",       "Белое на белом",                  "Казимир Малевич",           "1918", "Kazimir_Malevich_-_'Suprematist_Composition-_White_on_White',_oil_on_canvas,_1918,_Museum_of_Modern_Art.jpg"),

    # === American ===
    ("nighthawks",           "Полуночники",                     "Эдвард Хоппер",             "1942", "Nighthawks_by_Edward_Hopper_1942.jpg"),
    ("american-gothic",      "Американская готика",             "Грант Вуд",                 "1930", "Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg"),
    ("washington-crossing",  "Вашингтон переправляется через Делавэр","Эмануэль Лойце",     "1851", "Washington_Crossing_the_Delaware_by_Emanuel_Leutze,_MMA-NYC,_1851.jpg"),

    # === Russian masters ===
    ("bogatyrs",             "Богатыри",                        "Виктор Васнецов",           "1898", "1898_Vasnetsov_Bogatyrs_anagoria.JPG"),
    ("alyonushka",           "Алёнушка",                        "Виктор Васнецов",           "1881", "Vasnetsov_Alenushka.jpg"),
    ("ivan-tsarevich",       "Иван-царевич на Сером Волке",     "Виктор Васнецов",           "1889", "Wiktor_Michajlowitsch_Wassnezow_004.jpg"),
    ("morning-pines",        "Утро в сосновом лесу",            "Иван Шишкин",               "1889", "Shishkin,_Ivan_-_Morning_in_a_Pine_Forest.jpg"),
    ("rye-shishkin",         "Рожь",                            "Иван Шишкин",               "1878", "Ivan_Shishkin_-_Рожь_-_Google_Art_Project.jpg"),
    ("rooks-have-come",      "Грачи прилетели",                 "Алексей Саврасов",          "1871", "Aleksey_Savrasov_-_Грачи_прилетели_-_Google_Art_Project.jpg"),
    ("unknown-kramskoy",     "Неизвестная",                     "Иван Крамской",             "1883", "Kramskoy_Portrait_of_a_Woman.jpg"),
    ("volga-boatmen",        "Бурлаки на Волге",                "Илья Репин",                "1873", "Ilia_Efimovich_Repin_(1844-1930)_-_Volga_Boatmen_(1870-1873).jpg"),
    ("ivan-terrible-son",    "Иван Грозный и сын его Иван",     "Илья Репин",                "1885", "Iván_el_Terrible_y_su_hijo,_por_Iliá_Repin.jpg"),
    ("cossacks-letter",      "Запорожцы пишут письмо турецкому султану","Илья Репин",      "1891", "Repin_Cossacks.jpg"),
    ("boyaryna-morozova",    "Боярыня Морозова",                "Василий Суриков",           "1887", "Vasily_Surikov_-_Боярыня_Морозова_-_Google_Art_Project.jpg"),
    ("morning-of-execution", "Утро стрелецкой казни",           "Василий Суриков",           "1881", "Vasily_Surikov_-_Утро_стрелецкой_казни_-_Google_Art_Project.jpg"),
    ("girl-with-peaches",    "Девочка с персиками",             "Валентин Серов",            "1887", "Valentin_Serov_-_Девочка_с_персиками._Портрет_В.С.Мамонтовой_-_Google_Art_Project.jpg"),
    ("merchant-wife-tea",    "Купчиха за чаем",                 "Борис Кустодиев",           "1918", "Boris_Kustodiev_-_Merchant's_Wife_at_Tea_-_Google_Art_Project.jpg"),
    ("apotheosis-of-war",    "Апофеоз войны",                   "Василий Верещагин",         "1871", "Apotheosis.jpg"),
    ("appearance-christ",    "Явление Христа народу",           "Александр Иванов",          "1857", "Александр_Андреевич_Иванов_-_Явление_Христа_народу_(Явление_Мессии)_-_Google_Art_Project.jpg"),
    ("rainbow-savrasov",     "Радуга",                          "Алексей Саврасов",          "1875", "Savrasov_rainbow.JPG"),
    ("red-horse",            "Купание красного коня",           "Кузьма Петров-Водкин",      "1912", "Bathing_of_a_Red_Horse_(Petrov-Vodkin).jpg"),
    ("demon-vrubel",         "Демон сидящий",                   "Михаил Врубель",            "1890", "Vrubel_Demon.jpg"),
    ("swan-princess",        "Царевна-Лебедь",                  "Михаил Врубель",            "1900", "Tsarevna-Lebed_by_Mikhail_Vrubel_(brightened).jpg"),

    # === Realism / 19th c. ===
    ("monk-by-sea",          "Монах у моря",                    "Каспар Давид Фридрих",      "1810", "Caspar_David_Friedrich_-_Der_Mönch_am_Meer_-_Google_Art_Project.jpg"),
    ("ophelia-millais",      "Офелия",                           "Джон Эверетт Милле",       "1851-1852", "John_Everett_Millais_-_Ophelia_-_Google_Art_Project.jpg"),
    ("lady-shalott",         "Леди из Шалота",                  "Джон Уильям Уотерхаус",     "1888", "John_William_Waterhouse_-_The_Lady_of_Shalott_-_Google_Art_Project.jpg"),

    # === Japanese ukiyo-e ===
    ("great-wave",           "Большая волна в Канагаве",        "Кацусика Хокусай",          "1831", "Tsunami_by_hokusai_19th_century.jpg"),
    ("red-fuji",             "Победный ветер. Ясный день (Красная Фудзи)","Кацусика Хокусай","1831", "Red_Fuji_southern_wind_clear_morning.jpg"),

    # === Brueghel / Bosch extras ===
    ("peasant-wedding",      "Крестьянская свадьба",            "Питер Брейгель",            "ок. 1567", "Pieter_Bruegel_the_Elder_-_Peasant_Wedding_-_Google_Art_Project.jpg"),
    ("icarus-bruegel",       "Пейзаж с падением Икара",         "Питер Брейгель",            "ок. 1558", "Pieter_Bruegel_de_Oude_-_De_val_van_Icarus.jpg"),

    # === Klimt / Schiele ===
    ("portrait-adele",       "Портрет Адели Блох-Бауэр I",      "Густав Климт",              "1907", "Gustav_Klimt_046.jpg"),

    # === Extras ===
    ("naked-maja",           "Маха обнажённая",                 "Франсиско Гойя",            "1797-1800", "Maja_naga2.jpg"),
    ("clothed-maja",         "Маха одетая",                     "Франсиско Гойя",            "1800-1807", "Maja_vestida2.jpg"),
    ("hay-wain",             "Телега с сеном",                  "Джон Констебл",             "1821", "John_Constable_The_Hay_Wain.jpg"),
    ("death-of-marat",       "Смерть Марата",                   "Жак-Луи Давид",             "1793", "Death_of_Marat_by_David.jpg"),
    ("napoleon-alps",        "Наполеон на перевале Сен-Бернар", "Жак-Луи Давид",             "1801", "Jacques-Louis_David_-_Bonaparte_franchissant_le_Grand_Saint-Bernard,_20_mai_1800_-_Google_Art_Project.jpg"),
    ("oath-horatii",         "Клятва Горациев",                 "Жак-Луи Давид",             "1784", "Jacques-Louis_David_-_Oath_of_the_Horatii_-_Google_Art_Project.jpg"),
    ("grande-odalisque",     "Большая одалиска",                "Жан Огюст Доминик Энгр",    "1814", "Grande_Odalisque.jpg"),
    ("sea-of-ice",           "Море льдов",                      "Каспар Давид Фридрих",      "1824", "Caspar_David_Friedrich_-_Das_Eismeer_-_Hamburger_Kunsthalle_-_02.jpg"),
    ("massacre-chios",       "Резня на Хиосе",                  "Эжен Делакруа",             "1824", "Eugène_Delacroix_-_Le_Massacre_de_Scio.jpg"),
    ("la-grande-jatte-2",    "Цирк",                            "Жорж Сёра",                 "1891", "Georges_Seurat,_1890-91,_Le_Cirque_(The_Circus),_oil_on_canvas,_185_x_152_cm,_Musée_d'Orsay,_Paris.jpg"),
    ("man-pipe-courbet",     "Автопортрет (Человек с трубкой)", "Гюстав Курбе",              "1849", "Gustave_Courbet_-_Self-Portrait_(Man_with_a_Pipe)_-_WGA05456.jpg"),
    ("burial-ornans",        "Похороны в Орнане",               "Гюстав Курбе",              "1850", "Gustave_Courbet_-_A_Burial_at_Ornans_-_Google_Art_Project_2.jpg"),
    ("flower-carrier",       "Продавец цветов",                 "Диего Ривера",              "1935", "Diego_Rivera-The_Flower_Carrier_1935.jpg"),
    ("scream-second",        "Меланхолия",                      "Эдвард Мунк",               "1894", "Edvard_Munch_-_Melancholy_(1894-96).jpg"),
    ("bathers-cezanne",      "Большие купальщицы",              "Поль Сезанн",               "1906", "Cezanne_Big_Bathers.jpg"),
    ("apples-cezanne",       "Натюрморт с яблоками",            "Поль Сезанн",               "1894", "Paul_Cézanne_181.jpg"),
    ("self-port-rembrandt",  "Автопортрет",                     "Рембрандт",                 "1659", "Rembrandt_van_Rijn_-_Self-Portrait_-_Google_Art_Project.jpg"),
    ("vermeer-geographer",   "Географ",                         "Ян Вермеер",                "1669", "Jan_Vermeer_-_The_Geographer.JPG"),
    ("brueghel-icarus",      "Падение мятежных ангелов",        "Питер Брейгель",            "1562", "Pieter_Bruegel_the_Elder_-_The_Fall_of_the_Rebel_Angels_-_Google_Art_Project.jpg"),
    ("munch-vampire",        "Вампир",                          "Эдвард Мунк",               "1895", "Edvard_Munch_-_Vampire_(1895).jpg"),
    ("klimt-tree-of-life",   "Древо жизни",                     "Густав Климт",              "1909", "Gustav_Klimt_005.jpg"),
    ("repin-iv-grozny",      "Не ждали",                        "Илья Репин",                "1888", "Repin_unexpected.jpg"),
    ("levitan-evening",      "Над вечным покоем",               "Исаак Левитан",             "1894", "Isaak_Iljitsch_Lewitan_005.jpg"),
    ("levitan-vladimirka",   "Владимирка",                      "Исаак Левитан",             "1892", "Isaac_Levitan_-_Владимирка_-_Google_Art_Project.jpg"),
    ("polenov-courtyard",    "Московский дворик",               "Василий Поленов",           "1878", "Polenov_moscowyard.jpg"),
    ("aivazovsky-rainbow",   "Радуга",                          "Иван Айвазовский",          "1873", "Aivazovsky_-_Rainbow.jpg"),
    ("aivazovsky-among-waves","Среди волн",                     "Иван Айвазовский",          "1898", "Среди_волн_(Айвазовский,_1898).jpg"),
    ("rublev-trinity",       "Троица",                          "Андрей Рублёв",             "ок. 1425", "Angelsatmamre-trinity-rublev-1410.jpg"),
    ("vrubel-pan",           "Пан",                             "Михаил Врубель",            "1899", "Wrubel_Pan.jpg"),
    ("nesterov-vision-bartholomew","Видение отроку Варфоломею", "Михаил Нестеров",           "1890", "Видение_отроку_Варфоломею.jpg"),

    # === Surrealism (early) ===
    ("metamorphosis-narcissus","Метаморфоза Нарцисса",          "Сальвадор Дали",            "1937", "Dali-Metamorphose-Narziss.jpg"),
]


def check_url(file: str, sleep_s: float = 1.2) -> int:
    url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(file)}?width=480"
    res = subprocess.run(
        ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
         '-A', 'rich-speech-validator/1.0 (https://github.com/denysque/rich-speech)',
         '-L', '--max-time', '15', url],
        capture_output=True, text=True
    )
    time.sleep(sleep_s)
    try:
        return int(res.stdout.strip())
    except ValueError:
        return 0


def main():
    out_path = Path(__file__).parent.parent / 'src/data/paintings.json'
    print(f"validating {len(CANDIDATES)} candidates → {out_path}\n")
    valid = []
    rejected = []
    for i, (pid, title, artist, year, file) in enumerate(CANDIDATES, 1):
        code = check_url(file)
        ok = code == 200
        mark = '✓' if ok else '✗'
        print(f"  [{i:3d}/{len(CANDIDATES)}] {mark} {code} {pid:28s} {title}")
        if ok:
            valid.append({'id': pid, 'title': title, 'artist': artist, 'year': year, 'file': file})
        else:
            rejected.append((pid, title, file, code))

    out_path.write_text(json.dumps(valid, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"\n✓ {len(valid)} valid paintings written")
    if rejected:
        print(f"\n✗ {len(rejected)} rejected:")
        for r in rejected:
            print(f"  - {r[0]:28s} HTTP {r[3]}  file: {r[2]}")


if __name__ == '__main__':
    main()
