export type TravelAttractionKnowledgeItem = {
  cityKeys: string[];
  cityLabel: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  imageSrc: string;
  sourceUrl: string;
};

export function normalizeTravelKnowledgeKey(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

export const TRAVEL_ATTRACTION_KNOWLEDGE: TravelAttractionKnowledgeItem[] = [
  {
    cityKeys: ["tokyo", "东京", "東京"],
    cityLabel: "东京",
    name: "浅草寺与仲见世商店街",
    location: "2 Chome-3-1 Asakusa, Taito City, Tokyo",
    lat: 35.7148,
    lng: 139.7967,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Asakusa_Sensoji_Kaminarimon_2012.JPG/960px-Asakusa_Sensoji_Kaminarimon_2012.JPG",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Asakusa_Sensoji_Kaminarimon_2012.JPG",
  },
  {
    cityKeys: ["tokyo", "东京", "東京"],
    cityLabel: "东京",
    name: "东京塔与芝公园",
    location: "4 Chome-2-8 Shibakoen, Minato City, Tokyo",
    lat: 35.6586,
    lng: 139.7454,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Tokyo_Tower_seen_from_Shiba_Park.jpg/960px-Tokyo_Tower_seen_from_Shiba_Park.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Tokyo_Tower_seen_from_Shiba_Park.jpg",
  },
  {
    cityKeys: ["tokyo", "东京", "東京"],
    cityLabel: "东京",
    name: "明治神宫",
    location: "1-1 Yoyogikamizonocho, Shibuya City, Tokyo",
    lat: 35.6764,
    lng: 139.6993,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Meiji_Shrine%2C_Tokyo%3B_April_2009_%2801%29.jpg/960px-Meiji_Shrine%2C_Tokyo%3B_April_2009_%2801%29.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Meiji_Shrine,_Tokyo;_April_2009_(01).jpg",
  },
  {
    cityKeys: ["tokyo", "东京", "東京"],
    cityLabel: "东京",
    name: "涩谷十字路口与忠犬八公像",
    location: "Shibuya Scramble Crossing, Shibuya City, Tokyo",
    lat: 35.6595,
    lng: 139.7005,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Shibuya_Crossing%2C_Aerial.jpg/960px-Shibuya_Crossing%2C_Aerial.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Shibuya_Crossing,_Aerial.jpg",
  },
  {
    cityKeys: ["tokyo", "东京", "東京"],
    cityLabel: "东京",
    name: "筑地场外市场",
    location: "4 Chome-16 Tsukiji, Chuo City, Tokyo",
    lat: 35.6654,
    lng: 139.7707,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Tsukiji_Outer_Market_-04.jpg/960px-Tsukiji_Outer_Market_-04.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Tsukiji_Outer_Market_-04.jpg",
  },
  {
    cityKeys: ["tokyo", "东京", "東京"],
    cityLabel: "东京",
    name: "上野公园与东京国立博物馆",
    location: "13-9 Uenokoen, Taito City, Tokyo",
    lat: 35.7188,
    lng: 139.7765,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Tokyo_National_Museum_-_Ueno_Park%2C_Tokyo%2C_Japan_-_DSC08641.jpg/960px-Tokyo_National_Museum_-_Ueno_Park%2C_Tokyo%2C_Japan_-_DSC08641.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Tokyo_National_Museum_-_Ueno_Park,_Tokyo,_Japan_-_DSC08641.jpg",
  },
  {
    cityKeys: ["tokyo", "东京", "東京"],
    cityLabel: "东京",
    name: "新宿御苑",
    location: "11 Naitomachi, Shinjuku City, Tokyo",
    lat: 35.6852,
    lng: 139.7101,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Shinjuku_Gyoen_National_Garden%2C_Tokyo%2C_20240822_1447_5457.jpg/960px-Shinjuku_Gyoen_National_Garden%2C_Tokyo%2C_20240822_1447_5457.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Shinjuku_Gyoen_National_Garden,_Tokyo,_20240822_1447_5457.jpg",
  },
  {
    cityKeys: ["tokyo", "东京", "東京"],
    cityLabel: "东京",
    name: "秋叶原电器街",
    location: "Akihabara Electric Town, Chiyoda City, Tokyo",
    lat: 35.6984,
    lng: 139.773,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Akihabara_Electric_Town%2C_Tokyo%2C_20240823_1617_5580.jpg/960px-Akihabara_Electric_Town%2C_Tokyo%2C_20240823_1617_5580.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Akihabara_Electric_Town,_Tokyo,_20240823_1617_5580.jpg",
  },
  {
    cityKeys: ["tokyo", "东京", "東京"],
    cityLabel: "东京",
    name: "东京晴空塔",
    location: "1 Chome-1-2 Oshiage, Sumida City, Tokyo",
    lat: 35.7101,
    lng: 139.8107,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Tokyo_Skytree_2014_%E2%85%A2.jpg/960px-Tokyo_Skytree_2014_%E2%85%A2.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Tokyo_Skytree_2014_%E2%85%A2.jpg",
  },
  {
    cityKeys: ["tokyo", "东京", "東京"],
    cityLabel: "东京",
    name: "新宿思出横丁拉面",
    location: "Omoide Yokocho, Shinjuku City, Tokyo",
    lat: 35.6937,
    lng: 139.6996,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/2024-10-20_Omoide-Yokoch%C5%8D%2C_Shinjuku.jpg/960px-2024-10-20_Omoide-Yokoch%C5%8D%2C_Shinjuku.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:2024-10-20_Omoide-Yokoch%C5%8D,_Shinjuku.jpg",
  },
  {
    cityKeys: ["paris", "巴黎"],
    cityLabel: "巴黎",
    name: "埃菲尔铁塔与战神广场",
    location: "Champ de Mars, 5 Avenue Anatole France, 75007 Paris",
    lat: 48.858222,
    lng: 2.2945,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/330px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Eiffel_Tower",
  },
  {
    cityKeys: ["paris", "巴黎"],
    cityLabel: "巴黎",
    name: "卢浮宫与玻璃金字塔",
    location: "Rue de Rivoli, 75001 Paris",
    lat: 48.8611,
    lng: 2.3358,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Louvre_Museum_Wikimedia_Commons.jpg/330px-Louvre_Museum_Wikimedia_Commons.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Louvre",
  },
  {
    cityKeys: ["paris", "巴黎"],
    cityLabel: "巴黎",
    name: "巴黎圣母院与西岱岛",
    location: "6 Parvis Notre-Dame - Pl. Jean-Paul II, 75004 Paris",
    lat: 48.853056,
    lng: 2.35,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Notre-Dame_de_Paris%2C_4_October_2017.jpg/330px-Notre-Dame_de_Paris%2C_4_October_2017.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Notre-Dame_de_Paris",
  },
  {
    cityKeys: ["paris", "巴黎"],
    cityLabel: "巴黎",
    name: "蒙马特高地与圣心大教堂",
    location: "35 Rue du Chevalier de la Barre, 75018 Paris",
    lat: 48.8867,
    lng: 2.3431,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Le_sacre_coeur.jpg/330px-Le_sacre_coeur.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Sacr%C3%A9-C%C5%93ur,_Paris",
  },
  {
    cityKeys: ["paris", "巴黎"],
    cityLabel: "巴黎",
    name: "凯旋门与香榭丽舍大街",
    location: "Place Charles de Gaulle, 75008 Paris",
    lat: 48.873778,
    lng: 2.295028,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Arc_de_Triomphe%2C_Paris_21_October_2010.jpg/330px-Arc_de_Triomphe%2C_Paris_21_October_2010.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Arc_de_Triomphe",
  },
  {
    cityKeys: ["lyon", "里昂"],
    cityLabel: "里昂",
    name: "富维耶圣母圣殿",
    location: "8 Place de Fourviere, 69005 Lyon",
    lat: 45.7625,
    lng: 4.8225,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Fourviere_Lyon.jpg/330px-Fourviere_Lyon.jpg",
    sourceUrl:
      "https://en.wikipedia.org/wiki/Basilica_of_Notre-Dame_de_Fourvi%C3%A8re",
  },
  {
    cityKeys: ["lyon", "里昂"],
    cityLabel: "里昂",
    name: "里昂老城与圣让街区",
    location: "Vieux Lyon, 69005 Lyon",
    lat: 45.762222,
    lng: 4.826667,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Vieuxlyon_saintjean_toits.jpg/330px-Vieuxlyon_saintjean_toits.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Vieux_Lyon",
  },
  {
    cityKeys: ["lyon", "里昂"],
    cityLabel: "里昂",
    name: "白莱果广场",
    location: "Place Bellecour, 69002 Lyon",
    lat: 45.7575,
    lng: 4.832222,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Place_Bellecour_%28Lyon%2C_2024%2C_version_recentr%C3%A9e_2%29.jpg/330px-Place_Bellecour_%28Lyon%2C_2024%2C_version_recentr%C3%A9e_2%29.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Place_Bellecour",
  },
  {
    cityKeys: ["lyon", "里昂"],
    cityLabel: "里昂",
    name: "金头公园",
    location: "Parc de la Tete d'Or, 69006 Lyon",
    lat: 45.78,
    lng: 4.854,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Parc_de_la_T%C3%AAte_d%27Or_Vue_sur_le_lac7.jpg/330px-Parc_de_la_T%C3%AAte_d%27Or_Vue_sur_le_lac7.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Parc_de_la_T%C3%AAte_d%27or",
  },
  {
    cityKeys: ["lyon", "里昂"],
    cityLabel: "里昂",
    name: "里昂美术馆",
    location: "20 Place des Terreaux, 69001 Lyon",
    lat: 45.7669,
    lng: 4.8336,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/MBA_Lyon_facade_jour.jpg/330px-MBA_Lyon_facade_jour.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Museum_of_Fine_Arts_of_Lyon",
  },
  {
    cityKeys: ["lyon", "里昂"],
    cityLabel: "里昂",
    name: "特拉布勒隐秘通道",
    location: "Vieux Lyon traboules, 69005 Lyon",
    lat: 45.7643,
    lng: 4.8272,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Traboule_courtyard_C_staircase_Lyon.jpg/330px-Traboule_courtyard_C_staircase_Lyon.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Traboule",
  },
  {
    cityKeys: ["marseille", "马赛"],
    cityLabel: "马赛",
    name: "马赛老港",
    location: "Vieux-Port de Marseille, 13001 Marseille",
    lat: 43.294722,
    lng: 5.370833,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Marseille_Old_Port.jpg/330px-Marseille_Old_Port.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Old_Port_of_Marseille",
  },
  {
    cityKeys: ["marseille", "马赛"],
    cityLabel: "马赛",
    name: "守护圣母圣殿",
    location: "Rue Fort du Sanctuaire, 13006 Marseille",
    lat: 43.2841,
    lng: 5.371,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Notre-Dame_de_la_Garde_aerial_view_2020.jpeg/330px-Notre-Dame_de_la_Garde_aerial_view_2020.jpeg",
    sourceUrl: "https://en.wikipedia.org/wiki/Notre-Dame_de_la_Garde",
  },
  {
    cityKeys: ["marseille", "马赛"],
    cityLabel: "马赛",
    name: "卡朗格国家公园",
    location: "Calanques National Park, Marseille",
    lat: 43.216667,
    lng: 5.466667,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/En-Vau_calanque_4.jpg/330px-En-Vau_calanque_4.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Calanques_National_Park",
  },
  {
    cityKeys: ["marseille", "马赛"],
    cityLabel: "马赛",
    name: "欧洲及地中海文明博物馆 Mucem",
    location: "1 Esplanade J4, 13002 Marseille",
    lat: 43.2967,
    lng: 5.361,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/MuCEM%2C_Marseille_2015.jpg/330px-MuCEM%2C_Marseille_2015.jpg",
    sourceUrl:
      "https://en.wikipedia.org/wiki/Museum_of_European_and_Mediterranean_Civilisations",
  },
  {
    cityKeys: ["marseille", "马赛"],
    cityLabel: "马赛",
    name: "伊夫堡",
    location: "Chateau d'If, Frioul archipelago, Marseille",
    lat: 43.279861,
    lng: 5.325139,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Chateau_d%27If_view.jpg/330px-Chateau_d%27If_view.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Ch%C3%A2teau_d'If",
  },
  {
    cityKeys: ["marseille", "马赛"],
    cityLabel: "马赛",
    name: "勒帕尼耶老城区",
    location: "Le Panier, 13002 Marseille",
    lat: 43.3004,
    lng: 5.3698,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Marseille_Old_Port.jpg/330px-Marseille_Old_Port.jpg",
    sourceUrl: "https://en.wikivoyage.org/wiki/Marseille",
  },
  {
    cityKeys: ["nice", "尼斯"],
    cityLabel: "尼斯",
    name: "英国人漫步大道",
    location: "Promenade des Anglais, 06000 Nice",
    lat: 43.6957,
    lng: 7.2654,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/CollineDuChateau_NiceFrance2022.png/330px-CollineDuChateau_NiceFrance2022.png",
    sourceUrl: "https://en.wikipedia.org/wiki/Promenade_des_Anglais",
  },
  {
    cityKeys: ["nice", "尼斯"],
    cityLabel: "尼斯",
    name: "城堡山公园",
    location: "Colline du Chateau, 06300 Nice",
    lat: 43.696,
    lng: 7.2797,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/CollineDuChateau_NiceFrance2022.png/330px-CollineDuChateau_NiceFrance2022.png",
    sourceUrl: "https://en.wikipedia.org/wiki/Castle_of_Nice",
  },
  {
    cityKeys: ["nice", "尼斯"],
    cityLabel: "尼斯",
    name: "尼斯老城",
    location: "Vieux Nice, 06300 Nice",
    lat: 43.6975,
    lng: 7.2765,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Cours_Saleya_Nice.jpg/330px-Cours_Saleya_Nice.jpg",
    sourceUrl: "https://en.wikivoyage.org/wiki/Nice",
  },
  {
    cityKeys: ["nice", "尼斯"],
    cityLabel: "尼斯",
    name: "马塞纳广场",
    location: "Place Massena, 06000 Nice",
    lat: 43.6979,
    lng: 7.2709,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Place_Massena_Nice.jpg/330px-Place_Massena_Nice.jpg",
    sourceUrl: "https://en.wikivoyage.org/wiki/Nice",
  },
  {
    cityKeys: ["nice", "尼斯"],
    cityLabel: "尼斯",
    name: "萨雷雅市场",
    location: "Cours Saleya, 06300 Nice",
    lat: 43.6954,
    lng: 7.2767,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Cours_Saleya_Nice.jpg/330px-Cours_Saleya_Nice.jpg",
    sourceUrl: "https://en.wikivoyage.org/wiki/Nice",
  },
  {
    cityKeys: ["nice", "尼斯"],
    cityLabel: "尼斯",
    name: "马蒂斯美术馆",
    location: "164 Avenue des Arenes de Cimiez, 06000 Nice",
    lat: 43.7196,
    lng: 7.2769,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/MatisseMuseumNice.jpg/330px-MatisseMuseumNice.jpg",
    sourceUrl: "https://en.wikipedia.org/wiki/Mus%C3%A9e_Matisse_(Nice)",
  },
  {
    cityKeys: ["newyork", "new york", "nyc", "纽约"],
    cityLabel: "纽约",
    name: "中央公园与湖畔步道",
    location: "Central Park, Manhattan, New York, NY",
    lat: 40.7812,
    lng: -73.9665,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Gapstow_bridge_of_central_park_in_november.jpg/960px-Gapstow_bridge_of_central_park_in_november.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Gapstow_bridge_of_central_park_in_november.jpg",
  },
  {
    cityKeys: ["newyork", "new york", "nyc", "纽约"],
    cityLabel: "纽约",
    name: "帝国大厦观景台",
    location: "20 W 34th St., New York, NY",
    lat: 40.7484,
    lng: -73.9857,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Empire_State_Building_from_Brooklyn_Bridge.jpg/960px-Empire_State_Building_from_Brooklyn_Bridge.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Empire_State_Building_from_Brooklyn_Bridge.jpg",
  },
  {
    cityKeys: ["newyork", "new york", "nyc", "纽约"],
    cityLabel: "纽约",
    name: "时代广场霓虹街区",
    location: "Times Square, Manhattan, New York, NY",
    lat: 40.758,
    lng: -73.9855,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Times_Square%2C_New_York_City%2C_20231006_1916_2338.jpg/960px-Times_Square%2C_New_York_City%2C_20231006_1916_2338.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Times_Square,_New_York_City,_20231006_1916_2338.jpg",
  },
  {
    cityKeys: ["newyork", "new york", "nyc", "纽约"],
    cityLabel: "纽约",
    name: "自由女神像与自由岛",
    location: "Liberty Island, New York, NY",
    lat: 40.6892,
    lng: -74.0445,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Statue_of_Liberty_7.jpg/960px-Statue_of_Liberty_7.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Statue_of_Liberty_7.jpg",
  },
  {
    cityKeys: ["newyork", "new york", "nyc", "纽约"],
    cityLabel: "纽约",
    name: "布鲁克林大桥与丹波街区",
    location: "Brooklyn Bridge, New York, NY",
    lat: 40.7061,
    lng: -73.9969,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Brooklyn_Bridge_Postdlf.jpg/960px-Brooklyn_Bridge_Postdlf.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Brooklyn_Bridge_Postdlf.jpg",
  },
  {
    cityKeys: ["newyork", "new york", "nyc", "纽约"],
    cityLabel: "纽约",
    name: "中央车站主大厅",
    location: "89 E 42nd St, New York, NY",
    lat: 40.7527,
    lng: -73.9772,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Grand_Central_Station_Main_Concourse_Jan_2006.jpg/960px-Grand_Central_Station_Main_Concourse_Jan_2006.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Grand_Central_Station_Main_Concourse_Jan_2006.jpg",
  },
  {
    cityKeys: ["newyork", "new york", "nyc", "纽约"],
    cityLabel: "纽约",
    name: "大都会艺术博物馆",
    location: "1000 5th Ave, New York, NY",
    lat: 40.7794,
    lng: -73.9632,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Metropolitan_Museum_of_Art_%28The_Met%29_-_Central_Park%2C_NYC.jpg/960px-Metropolitan_Museum_of_Art_%28The_Met%29_-_Central_Park%2C_NYC.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Metropolitan_Museum_of_Art_(The_Met)_-_Central_Park,_NYC.jpg",
  },
  {
    cityKeys: ["newyork", "new york", "nyc", "纽约"],
    cityLabel: "纽约",
    name: "高线公园与切尔西画廊",
    location: "The High Line, New York, NY",
    lat: 40.74799,
    lng: -74.0048,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/High_Line_20th_Street_looking_downtown.jpg/960px-High_Line_20th_Street_looking_downtown.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:High_Line_20th_Street_looking_downtown.jpg",
  },
  {
    cityKeys: ["newyork", "new york", "nyc", "纽约"],
    cityLabel: "纽约",
    name: "9/11 纪念博物馆",
    location: "180 Greenwich St, New York, NY",
    lat: 40.7115,
    lng: -74.0134,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/New_York_-_National_September_11_Memorial_South_Pool_-_April_2012_-_9693C.jpg/960px-New_York_-_National_September_11_Memorial_South_Pool_-_April_2012_-_9693C.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:New_York_-_National_September_11_Memorial_South_Pool_-_April_2012_-_9693C.jpg",
  },
  {
    cityKeys: ["newyork", "new york", "nyc", "纽约"],
    cityLabel: "纽约",
    name: "纽约公共图书馆与布莱恩特公园",
    location: "476 5th Ave, New York, NY",
    lat: 40.7532,
    lng: -73.9822,
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/At_New_York_City_2023_124.jpg/960px-At_New_York_City_2023_124.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:At_New_York_City_2023_124.jpg",
  },
];

function itemMatchesCity(item: TravelAttractionKnowledgeItem, city: string): boolean {
  const cityKey = normalizeTravelKnowledgeKey(city);
  return item.cityKeys.some(
    (key) => normalizeTravelKnowledgeKey(key) === cityKey
  );
}

export function getTravelAttractionsForCity(
  city: string
): TravelAttractionKnowledgeItem[] {
  return TRAVEL_ATTRACTION_KNOWLEDGE.filter((item) => itemMatchesCity(item, city));
}

export function getTravelAttractionNamesForCity(city: string): string[] {
  return getTravelAttractionsForCity(city).map((item) => item.name);
}

export function findTravelAttraction(
  city: string,
  attractionName: string
): TravelAttractionKnowledgeItem | null {
  const targetKey = normalizeTravelKnowledgeKey(attractionName);
  if (!targetKey) return null;

  const cityAttractions = getTravelAttractionsForCity(city);
  return (
    cityAttractions.find((item) => {
      const itemKey = normalizeTravelKnowledgeKey(item.name);
      return itemKey === targetKey || targetKey.includes(itemKey) || itemKey.includes(targetKey);
    }) ?? null
  );
}
