/**
 * generate.js
 * Dünya başkentleri verisini DuckDB (Node) ile CSV ve Parquet olarak kaydeder.
 * Çalıştır: node generate.js
 */

const duckdb = require("duckdb");
const fs = require("fs");
const path = require("path");

// ── veri ────────────────────────────────────────────────────────────────────
const CAPITALS = [
    // Africa
    { name: "Algiers", country: "Algeria", lat: 36.74, lng: 3.06, population: 3415811, continent: "Africa" },
    { name: "Luanda", country: "Angola", lat: -8.84, lng: 13.23, population: 8330000, continent: "Africa" },
    { name: "Porto-Novo", country: "Benin", lat: 6.49, lng: 2.63, population: 264320, continent: "Africa" },
    { name: "Gaborone", country: "Botswana", lat: -24.65, lng: 25.91, population: 231626, continent: "Africa" },
    { name: "Ouagadougou", country: "Burkina Faso", lat: 12.36, lng: -1.53, population: 2780000, continent: "Africa" },
    { name: "Bujumbura", country: "Burundi", lat: -3.38, lng: 29.36, population: 1144000, continent: "Africa" },
    { name: "Yaounde", country: "Cameroon", lat: 3.87, lng: 11.52, population: 3900000, continent: "Africa" },
    { name: "Praia", country: "Cape Verde", lat: 14.93, lng: -23.51, population: 131719, continent: "Africa" },
    { name: "Bangui", country: "Central African Republic", lat: 4.36, lng: 18.55, population: 889231, continent: "Africa" },
    { name: "N'Djamena", country: "Chad", lat: 12.11, lng: 15.04, population: 1653000, continent: "Africa" },
    { name: "Moroni", country: "Comoros", lat: -11.70, lng: 43.25, population: 60200, continent: "Africa" },
    { name: "Kinshasa", country: "DR Congo", lat: -4.32, lng: 15.32, population: 15628085, continent: "Africa" },
    { name: "Brazzaville", country: "Republic of Congo", lat: -4.27, lng: 15.28, population: 2388000, continent: "Africa" },
    { name: "Djibouti", country: "Djibouti", lat: 11.59, lng: 43.15, population: 562000, continent: "Africa" },
    { name: "Cairo", country: "Egypt", lat: 30.06, lng: 31.25, population: 21322750, continent: "Africa" },
    { name: "Malabo", country: "Equatorial Guinea", lat: 3.75, lng: 8.78, population: 187302, continent: "Africa" },
    { name: "Asmara", country: "Eritrea", lat: 15.33, lng: 38.93, population: 963000, continent: "Africa" },
    { name: "Addis Ababa", country: "Ethiopia", lat: 9.03, lng: 38.74, population: 3638000, continent: "Africa" },
    { name: "Libreville", country: "Gabon", lat: 0.39, lng: 9.45, population: 797003, continent: "Africa" },
    { name: "Banjul", country: "Gambia", lat: 13.45, lng: -16.58, population: 31356, continent: "Africa" },
    { name: "Accra", country: "Ghana", lat: 5.56, lng: -0.20, population: 2291352, continent: "Africa" },
    { name: "Conakry", country: "Guinea", lat: 9.54, lng: -13.68, population: 1767200, continent: "Africa" },
    { name: "Bissau", country: "Guinea-Bissau", lat: 11.86, lng: -15.60, population: 492004, continent: "Africa" },
    { name: "Yamoussoukro", country: "Ivory Coast", lat: 6.82, lng: -5.28, population: 212670, continent: "Africa" },
    { name: "Nairobi", country: "Kenya", lat: -1.29, lng: 36.82, population: 4397073, continent: "Africa" },
    { name: "Maseru", country: "Lesotho", lat: -29.32, lng: 27.48, population: 330760, continent: "Africa" },
    { name: "Monrovia", country: "Liberia", lat: 6.30, lng: -10.80, population: 1418000, continent: "Africa" },
    { name: "Tripoli", country: "Libya", lat: 32.90, lng: 13.18, population: 1158000, continent: "Africa" },
    { name: "Antananarivo", country: "Madagascar", lat: -18.91, lng: 47.54, population: 3058453, continent: "Africa" },
    { name: "Lilongwe", country: "Malawi", lat: -13.97, lng: 33.79, population: 1077116, continent: "Africa" },
    { name: "Bamako", country: "Mali", lat: 12.65, lng: -8.00, population: 2715000, continent: "Africa" },
    { name: "Nouakchott", country: "Mauritania", lat: 18.08, lng: -15.97, population: 1205000, continent: "Africa" },
    { name: "Port Louis", country: "Mauritius", lat: -20.16, lng: 57.50, population: 149194, detention: "Africa", continent: "Africa" },
    { name: "Rabat", country: "Morocco", lat: 34.02, lng: -6.85, population: 577827, continent: "Africa" },
    { name: "Maputo", country: "Mozambique", lat: -25.97, lng: 32.58, population: 1101170, continent: "Africa" },
    { name: "Windhoek", country: "Namibia", lat: -22.56, lng: 17.08, population: 431000, continent: "Africa" },
    { name: "Niamey", country: "Niger", lat: 13.51, lng: 2.11, population: 1267000, continent: "Africa" },
    { name: "Abuja", country: "Nigeria", lat: 9.07, lng: 7.40, population: 3464000, continent: "Africa" },
    { name: "Kigali", country: "Rwanda", lat: -1.94, lng: 30.06, population: 1132686, continent: "Africa" },
    { name: "Sao Tome", country: "São Tomé and Príncipe", lat: 0.34, lng: 6.73, population: 71868, continent: "Africa" },
    { name: "Dakar", country: "Senegal", lat: 14.69, lng: -17.44, population: 3137196, continent: "Africa" },
    { name: "Victoria", country: "Seychelles", lat: -4.62, lng: 55.45, population: 27708, continent: "Africa" },
    { name: "Freetown", country: "Sierra Leone", lat: 8.49, lng: -13.23, population: 1134000, continent: "Africa" },
    { name: "Mogadishu", country: "Somalia", lat: 2.05, lng: 45.34, population: 2587000, continent: "Africa" },
    { name: "Pretoria", country: "South Africa", lat: -25.74, lng: 28.19, population: 2921488, continent: "Africa" },
    { name: "Juba", country: "South Sudan", lat: 4.86, lng: 31.60, population: 525953, continent: "Africa" },
    { name: "Khartoum", country: "Sudan", lat: 15.55, lng: 32.53, population: 5534000, continent: "Africa" },
    { name: "Mbabane", country: "Eswatini", lat: -26.32, lng: 31.14, population: 68000, continent: "Africa" },
    { name: "Dodoma", country: "Tanzania", lat: -6.17, lng: 35.74, population: 410956, continent: "Africa" },
    { name: "Lome", country: "Togo", lat: 6.14, lng: 1.22, population: 837437, continent: "Africa" },
    { name: "Tunis", country: "Tunisia", lat: 36.82, lng: 10.17, population: 638845, continent: "Africa" },
    { name: "Kampala", country: "Uganda", lat: 0.34, lng: 32.58, population: 1680000, continent: "Africa" },
    { name: "Lusaka", country: "Zambia", lat: -15.42, lng: 28.28, population: 2787978, continent: "Africa" },
    { name: "Harare", country: "Zimbabwe", lat: -17.83, lng: 31.05, population: 1542813, continent: "Africa" },

    // Asia
    { name: "Kabul", country: "Afghanistan", lat: 34.53, lng: 69.17, population: 4601789, continent: "Asia" },
    { name: "Yerevan", country: "Armenia", lat: 40.18, lng: 44.51, population: 1093485, continent: "Asia" },
    { name: "Baku", country: "Azerbaijan", lat: 40.41, lng: 49.87, population: 2286200, continent: "Asia" },
    { name: "Manama", country: "Bahrain", lat: 26.21, lng: 50.59, population: 153395, continent: "Asia" },
    { name: "Dhaka", country: "Bangladesh", lat: 23.72, lng: 90.41, population: 10356500, continent: "Asia" },
    { name: "Thimphu", country: "Bhutan", lat: 27.47, lng: 89.64, population: 114551, continent: "Asia" },
    { name: "Bandar Seri Begawan", country: "Brunei", lat: 4.94, lng: 114.95, population: 100700, continent: "Asia" },
    { name: "Phnom Penh", country: "Cambodia", lat: 11.56, lng: 104.92, population: 1573544, continent: "Asia" },
    { name: "Beijing", country: "China", lat: 39.91, lng: 116.39, population: 21893095, continent: "Asia" },
    { name: "Tbilisi", country: "Georgia", lat: 41.69, lng: 44.83, population: 1171100, continent: "Asia" },
    { name: "New Delhi", country: "India", lat: 28.61, lng: 77.23, population: 32941000, continent: "Asia" },
    { name: "Jakarta", country: "Indonesia", lat: -6.21, lng: 106.84, population: 10770487, continent: "Asia" },
    { name: "Tehran", country: "Iran", lat: 35.69, lng: 51.42, population: 9259009, continent: "Asia" },
    { name: "Baghdad", country: "Iraq", lat: 33.34, lng: 44.40, population: 7348000, continent: "Asia" },
    { name: "Jerusalem", country: "Israel", lat: 31.77, lng: 35.22, population: 936425, continent: "Asia" },
    { name: "Tokyo", country: "Japan", lat: 35.69, lng: 139.69, population: 13960000, continent: "Asia" },
    { name: "Amman", country: "Jordan", lat: 31.96, lng: 35.95, population: 4007526, continent: "Asia" },
    { name: "Nur-Sultan", country: "Kazakhstan", lat: 51.18, lng: 71.45, population: 1136000, continent: "Asia" },
    { name: "Kuwait City", country: "Kuwait", lat: 29.37, lng: 47.98, population: 340000, continent: "Asia" },
    { name: "Bishkek", country: "Kyrgyzstan", lat: 42.87, lng: 74.59, population: 1012500, continent: "Asia" },
    { name: "Vientiane", country: "Laos", lat: 17.97, lng: 102.60, population: 948477, continent: "Asia" },
    { name: "Beirut", country: "Lebanon", lat: 33.89, lng: 35.50, population: 2385649, continent: "Asia" },
    { name: "Kuala Lumpur", country: "Malaysia", lat: 3.14, lng: 101.69, population: 1982112, continent: "Asia" },
    { name: "Male", country: "Maldives", lat: 4.17, lng: 73.51, population: 133412, continent: "Asia" },
    { name: "Ulaanbaatar", country: "Mongolia", lat: 47.91, lng: 106.88, population: 1466000, continent: "Asia" },
    { name: "Naypyidaw", country: "Myanmar", lat: 19.76, lng: 96.08, population: 924608, continent: "Asia" },
    { name: "Kathmandu", country: "Nepal", lat: 27.71, lng: 85.32, population: 1442271, continent: "Asia" },
    { name: "Muscat", country: "Oman", lat: 23.61, lng: 58.59, population: 1421409, continent: "Asia" },
    { name: "Islamabad", country: "Pakistan", lat: 33.72, lng: 73.04, population: 1095064, continent: "Asia" },
    { name: "Manila", country: "Philippines", lat: 14.60, lng: 120.98, population: 1846513, continent: "Asia" },
    { name: "Doha", country: "Qatar", lat: 25.28, lng: 51.53, population: 796947, continent: "Asia" },
    { name: "Riyadh", country: "Saudi Arabia", lat: 24.69, lng: 46.72, population: 7231447, continent: "Asia" },
    { name: "Singapore", country: "Singapore", lat: 1.35, lng: 103.82, population: 5850342, continent: "Asia" },
    { name: "Seoul", country: "South Korea", lat: 37.57, lng: 126.98, population: 9765623, continent: "Asia" },
    { name: "Colombo", country: "Sri Lanka", lat: 6.93, lng: 79.85, population: 752993, continent: "Asia" },
    { name: "Damascus", country: "Syria", lat: 33.51, lng: 36.29, population: 2503000, continent: "Asia" },
    { name: "Dushanbe", country: "Tajikistan", lat: 38.56, lng: 68.77, population: 863400, continent: "Asia" },
    { name: "Bangkok", country: "Thailand", lat: 13.75, lng: 100.52, population: 10539415, continent: "Asia" },
    { name: "Dili", country: "Timor-Leste", lat: -8.56, lng: 125.58, population: 222323, continent: "Asia" },
    { name: "Ashgabat", country: "Turkmenistan", lat: 37.95, lng: 58.38, population: 1031992, continent: "Asia" },
    { name: "Ankara", country: "Turkey", lat: 39.93, lng: 32.85, population: 5700000, continent: "Asia" },
    { name: "Abu Dhabi", country: "UAE", lat: 24.45, lng: 54.38, population: 1483000, continent: "Asia" },
    { name: "Tashkent", country: "Uzbekistan", lat: 41.30, lng: 69.27, population: 2571668, continent: "Asia" },
    { name: "Hanoi", country: "Vietnam", lat: 21.03, lng: 105.85, population: 8053663, continent: "Asia" },
    { name: "Sanaa", country: "Yemen", lat: 15.37, lng: 44.19, population: 2957000, continent: "Asia" },
    { name: "Pyongyang", country: "North Korea", lat: 39.03, lng: 125.75, population: 3038000, continent: "Asia" },

    // Europe
    { name: "Tirana", country: "Albania", lat: 41.33, lng: 19.82, population: 418495, continent: "Europe" },
    { name: "Andorra la Vella", country: "Andorra", lat: 42.51, lng: 1.52, population: 22256, continent: "Europe" },
    { name: "Vienna", country: "Austria", lat: 48.21, lng: 16.37, population: 1931593, continent: "Europe" },
    { name: "Minsk", country: "Belarus", lat: 53.90, lng: 27.57, population: 1982444, continent: "Europe" },
    { name: "Brussels", country: "Belgium", lat: 50.85, lng: 4.35, population: 1209000, continent: "Europe" },
    { name: "Sarajevo", country: "Bosnia and Herzegovina", lat: 43.85, lng: 18.36, population: 275524, continent: "Europe" },
    { name: "Sofia", country: "Bulgaria", lat: 42.70, lng: 23.32, population: 1307376, continent: "Europe" },
    { name: "Zagreb", country: "Croatia", lat: 45.81, lng: 15.98, population: 806341, continent: "Europe" },
    { name: "Nicosia", country: "Cyprus", lat: 35.17, lng: 33.36, population: 349000, continent: "Europe" },
    { name: "Prague", country: "Czech Republic", lat: 50.08, lng: 14.44, population: 1335084, continent: "Europe" },
    { name: "Copenhagen", country: "Denmark", lat: 55.68, lng: 12.57, population: 794128, continent: "Europe" },
    { name: "Tallinn", country: "Estonia", lat: 59.44, lng: 24.75, population: 454024, continent: "Europe" },
    { name: "Helsinki", country: "Finland", lat: 60.17, lng: 24.94, population: 648042, continent: "Europe" },
    { name: "Paris", country: "France", lat: 48.86, lng: 2.35, population: 2161000, continent: "Europe" },
    { name: "Berlin", country: "Germany", lat: 52.52, lng: 13.40, population: 3644826, continent: "Europe" },
    { name: "Athens", country: "Greece", lat: 37.98, lng: 23.73, population: 3153000, continent: "Europe" },
    { name: "Budapest", country: "Hungary", lat: 47.50, lng: 19.04, population: 1752286, continent: "Europe" },
    { name: "Reykjavik", country: "Iceland", lat: 64.14, lng: -21.93, population: 131136, continent: "Europe" },
    { name: "Dublin", country: "Ireland", lat: 53.33, lng: -6.25, population: 1388000, continent: "Europe" },
    { name: "Rome", country: "Italy", lat: 41.89, lng: 12.48, population: 4355725, continent: "Europe" },
    { name: "Pristina", country: "Kosovo", lat: 42.67, lng: 21.17, population: 216870, continent: "Europe" },
    { name: "Riga", country: "Latvia", lat: 56.95, lng: 24.11, population: 605802, continent: "Europe" },
    { name: "Vaduz", country: "Liechtenstein", lat: 47.14, lng: 9.52, population: 5765, continent: "Europe" },
    { name: "Vilnius", country: "Lithuania", lat: 54.69, lng: 25.28, population: 536366, continent: "Europe" },
    { name: "Luxembourg", country: "Luxembourg", lat: 49.61, lng: 6.13, population: 125000, continent: "Europe" },
    { name: "Valletta", country: "Malta", lat: 35.90, lng: 14.51, population: 6794, continent: "Europe" },
    { name: "Chisinau", country: "Moldova", lat: 47.00, lng: 28.86, population: 532513, continent: "Europe" },
    { name: "Monaco", country: "Monaco", lat: 43.73, lng: 7.42, population: 36297, continent: "Europe" },
    { name: "Podgorica", country: "Montenegro", lat: 42.44, lng: 19.26, population: 186087, continent: "Europe" },
    { name: "Amsterdam", country: "Netherlands", lat: 52.37, lng: 4.90, population: 821752, continent: "Europe" },
    { name: "Skopje", country: "North Macedonia", lat: 42.00, lng: 21.43, population: 544086, continent: "Europe" },
    { name: "Oslo", country: "Norway", lat: 59.91, lng: 10.74, population: 673469, continent: "Europe" },
    { name: "Warsaw", country: "Poland", lat: 52.23, lng: 21.01, population: 1793579, continent: "Europe" },
    { name: "Lisbon", country: "Portugal", lat: 38.72, lng: -9.14, population: 564657, continent: "Europe" },
    { name: "Bucharest", country: "Romania", lat: 44.43, lng: 26.10, population: 1803425, continent: "Europe" },
    { name: "Moscow", country: "Russia", lat: 55.75, lng: 37.62, population: 12506468, continent: "Europe" },
    { name: "San Marino", country: "San Marino", lat: 43.94, lng: 12.46, population: 4493, continent: "Europe" },
    { name: "Belgrade", country: "Serbia", lat: 44.80, lng: 20.46, population: 1688667, continent: "Europe" },
    { name: "Bratislava", country: "Slovakia", lat: 48.15, lng: 17.11, population: 475503, continent: "Europe" },
    { name: "Ljubljana", country: "Slovenia", lat: 46.05, lng: 14.51, population: 294054, continent: "Europe" },
    { name: "Madrid", country: "Spain", lat: 40.42, lng: -3.70, population: 3305408, continent: "Europe" },
    { name: "Stockholm", country: "Sweden", lat: 59.33, lng: 18.07, population: 975551, continent: "Europe" },
    { name: "Bern", country: "Switzerland", lat: 46.95, lng: 7.44, population: 133883, continent: "Europe" },
    { name: "Kiev", country: "Ukraine", lat: 50.45, lng: 30.52, population: 2952301, continent: "Europe" },
    { name: "London", country: "United Kingdom", lat: 51.51, lng: -0.13, population: 9002488, continent: "Europe" },
    { name: "Vatican City", country: "Vatican", lat: 41.90, lng: 12.45, population: 764, continent: "Europe" },

    // North America
    { name: "Antigua", country: "Antigua and Barbuda", lat: 17.12, lng: -61.85, population: 24226, continent: "North America" },
    { name: "Nassau", country: "Bahamas", lat: 25.05, lng: -77.35, population: 274400, continent: "North America" },
    { name: "Bridgetown", country: "Barbados", lat: 13.10, lng: -59.62, population: 110000, continent: "North America" },
    { name: "Belmopan", country: "Belize", lat: 17.25, lng: -88.77, population: 16451, continent: "North America" },
    { name: "Ottawa", country: "Canada", lat: 45.42, lng: -75.70, population: 1017449, continent: "North America" },
    { name: "San Jose", country: "Costa Rica", lat: 9.93, lng: -84.08, population: 1000000, continent: "North America" },
    { name: "Havana", country: "Cuba", lat: 23.13, lng: -82.38, population: 2141652, continent: "North America" },
    { name: "Roseau", country: "Dominica", lat: 15.30, lng: -61.39, population: 16582, continent: "North America" },
    { name: "Santo Domingo", country: "Dominican Republic", lat: 18.48, lng: -69.90, population: 3524000, continent: "North America" },
    { name: "San Salvador", country: "El Salvador", lat: 13.69, lng: -89.19, population: 316090, continent: "North America" },
    { name: "St George's", country: "Grenada", lat: 12.05, lng: -61.75, population: 33734, continent: "North America" },
    { name: "Guatemala City", country: "Guatemala", lat: 14.64, lng: -90.51, population: 3015081, continent: "North America" },
    { name: "Port-au-Prince", country: "Haiti", lat: 18.54, lng: -72.34, population: 2844000, continent: "North America" },
    { name: "Tegucigalpa", country: "Honduras", lat: 14.10, lng: -87.21, population: 1444428, continent: "North America" },
    { name: "Kingston", country: "Jamaica", lat: 17.99, lng: -76.79, population: 937700, continent: "North America" },
    { name: "Mexico City", country: "Mexico", lat: 19.43, lng: -99.13, population: 9209944, continent: "North America" },
    { name: "Managua", country: "Nicaragua", lat: 12.13, lng: -86.28, population: 958000, continent: "North America" },
    { name: "Panama City", country: "Panama", lat: 8.99, lng: -79.52, population: 1500000, continent: "North America" },
    { name: "Basseterre", country: "Saint Kitts and Nevis", lat: 17.30, lng: -62.72, population: 13000, continent: "North America" },
    { name: "Castries", country: "Saint Lucia", lat: 14.00, lng: -60.99, population: 22000, continent: "North America" },
    { name: "Kingstown", country: "Saint Vincent", lat: 13.16, lng: -61.22, population: 25000, continent: "North America" },
    { name: "Port of Spain", country: "Trinidad and Tobago", lat: 10.65, lng: -61.52, population: 544000, continent: "North America" },
    { name: "Washington DC", country: "United States", lat: 38.91, lng: -77.04, population: 689545, continent: "North America" },

    // South America
    { name: "Buenos Aires", country: "Argentina", lat: -34.61, lng: -58.38, population: 3054300, continent: "South America" },
    { name: "Sucre", country: "Bolivia", lat: -19.04, lng: -65.26, population: 337187, continent: "South America" },
    { name: "Brasilia", country: "Brazil", lat: -15.78, lng: -47.93, population: 3015268, continent: "South America" },
    { name: "Santiago", country: "Chile", lat: -33.46, lng: -70.65, population: 5614000, continent: "South America" },
    { name: "Bogota", country: "Colombia", lat: 4.71, lng: -74.07, population: 7412566, continent: "South America" },
    { name: "Quito", country: "Ecuador", lat: -0.23, lng: -78.52, population: 1607734, continent: "South America" },
    { name: "Georgetown", country: "Guyana", lat: 6.80, lng: -58.16, population: 252700, continent: "South America" },
    { name: "Asuncion", country: "Paraguay", lat: -25.29, lng: -57.65, population: 524000, continent: "South America" },
    { name: "Lima", country: "Peru", lat: -12.06, lng: -77.04, population: 9751717, continent: "South America" },
    { name: "Paramaribo", country: "Suriname", lat: 5.85, lng: -55.20, population: 240924, continent: "South America" },
    { name: "Montevideo", country: "Uruguay", lat: -34.90, lng: -56.19, population: 1381000, continent: "South America" },
    { name: "Caracas", country: "Venezuela", lat: 10.48, lng: -66.88, population: 2900000, continent: "South America" },

    // Oceania
    { name: "Canberra", country: "Australia", lat: -35.28, lng: 149.13, population: 410301, continent: "Oceania" },
    { name: "Suva", country: "Fiji", lat: -18.14, lng: 178.44, population: 100000, continent: "Oceania" },
    { name: "Tarawa", country: "Kiribati", lat: 1.33, lng: 172.98, population: 63017, continent: "Oceania" },
    { name: "Majuro", country: "Marshall Islands", lat: 7.07, lng: 171.26, population: 27797, continent: "Oceania" },
    { name: "Palikir", country: "Micronesia", lat: 6.92, lng: 158.16, population: 7000, continent: "Oceania" },
    { name: "Wellington", country: "New Zealand", lat: -41.29, lng: 174.78, population: 412500, continent: "Oceania" },
    { name: "Melekeok", country: "Palau", lat: 7.49, lng: 134.63, population: 391, continent: "Oceania" },
    { name: "Port Moresby", country: "Papua New Guinea", lat: -9.44, lng: 147.18, population: 364125, continent: "Oceania" },
    { name: "Apia", country: "Samoa", lat: -13.84, lng: -171.77, population: 37391, continent: "Oceania" },
    { name: "Honiara", country: "Solomon Islands", lat: -9.43, lng: 160.02, population: 84520, continent: "Oceania" },
    { name: "Nuku'alofa", country: "Tonga", lat: -21.14, lng: -175.22, population: 23658, continent: "Oceania" },
    { name: "Funafuti", country: "Tuvalu", lat: -8.52, lng: 179.20, population: 6090, continent: "Oceania" },
    { name: "Port Vila", country: "Vanuatu", lat: -17.73, lng: 168.32, population: 51437, continent: "Oceania" },
];

// ── yardımcı: promise wrapper ─────────────────────────────────────────────
function run(db, sql) {
    return new Promise((res, rej) =>
        db.run(sql, err => err ? rej(err) : res())
    );
}
function exec(db, sql) {
    return new Promise((res, rej) =>
        db.exec(sql, err => err ? rej(err) : res())
    );
}

// ── ana akış ─────────────────────────────────────────────────────────────
async function main() {
    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

    const csvPath     = path.join(dataDir, "capitals.csv").replace(/\\/g, "/");
    const parquetPath = path.join(dataDir, "capitals.parquet").replace(/\\/g, "/");

    const db = new duckdb.Database(":memory:");

    // 1 – tablo oluştur
    await run(db, `
    CREATE TABLE capitals (
      name       VARCHAR,
      country    VARCHAR,
      lat        DOUBLE,
      lng        DOUBLE,
      population INTEGER,
      continent  VARCHAR
    )
  `);

    // 2 – satırları ekle
    for (const c of CAPITALS) {
        const safe = (s) => s.replace(/'/g, "''");
        await run(db, `
      INSERT INTO capitals VALUES (
        '${safe(c.name)}', '${safe(c.country)}',
        ${c.lat}, ${c.lng}, ${c.population}, '${safe(c.continent)}'
      )
    `);
    }

    //   3 – CSV'ye yaz
    await run(db, `COPY capitals TO '${csvPath}' (HEADER, DELIMITER ',')`);
    console.log(`✅ CSV  → ${csvPath}  (${CAPITALS.length} rows)`);

    // 4 – Parquet'e yaz
    await run(db, `COPY capitals TO '${parquetPath}' (FORMAT PARQUET)`);
    console.log(`✅ Parquet → ${parquetPath}  (${CAPITALS.length} rows)`);

    // 5 – kontrol sorgusu
    db.all("SELECT continent, COUNT(*) AS cnt, AVG(population)::INT AS avg_pop FROM capitals GROUP BY continent ORDER BY cnt DESC", (err, rows) => {
        if (err) throw err;
        console.log("\n📊 Kıta özeti:");
        console.table(rows);
        db.close();
    });
}

main().catch(err => { console.error(err); process.exit(1); });
