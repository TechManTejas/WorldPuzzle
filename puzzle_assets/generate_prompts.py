#!/usr/bin/env python3
"""
Prompt Generator for Puzzle Game Landmarks
Generates unique, handcrafted prompt files for AI image generation.
Each prompt is contextually tailored to the specific landmark.
"""

import json
import random
from pathlib import Path
from typing import Dict, List, Tuple

OUTPUT_DIR = Path("puzzle_prompts")

# Landmark-specific unique prompts - handcrafted per location
LANDMARK_PROMPTS: Dict[str, List[Tuple[str, str, str]]] = {
    "asia": [
        (
            "Taj Mahal",
            "India",
            "Stunning ivory-white marble mausoleum with four minarets reflected in long rectangular pool, symmetrical gardens with cypress trees, soft pink sunrise glow, mirror-like water surface, intricate floral inlays visible, romantic atmosphere, vertical portrait framing, 8k resolution"
        ),
        (
            "Great Wall of China",
            "China",
            "Ancient stone fortification snaking across mountain ridges, watchtowers silhouetted against misty valleys, golden morning sun breaking through clouds, weathered bricks with moss patches, dramatic elevation changes, endless perspective winding into distance, autumn foliage on hillsides"
        ),
        (
            "Mount Fuji",
            "Japan",
            "Perfect snow-capped volcanic cone rising above Lake Kawaguchi, cherry blossom trees in full bloom framing base, crystal clear reflections on still water, soft morning light with pink clouds, iconic symmetrical silhouette, serene zen atmosphere, five lakes region scenery"
        ),
        (
            "Petra",
            "Jordan",
            "Rose-red sandstone treasury carved into cliff face, narrow canyon entrance with towering walls, camels resting in foreground, warm desert sunset casting deep orange hues, intricate Hellenistic facades, Bedouin culture elements, dramatic rock formations surrounding the ancient city"
        ),
        (
            "Angkor Wat",
            "Cambodia",
            "Massive temple complex with five lotus-shaped towers, morning mist rising from surrounding moat, intricate bas-reliefs depicting mythology, ancient stone galleries with weathered patina, palm trees silhouetted against sky, saffron-robed monks walking the grounds, tropical jungle setting"
        ),
        (
            "Burj Khalifa",
            "UAE",
            "Sleek silver spire piercing the clouds, modern glass facade reflecting sunset colors, Dubai Fountain water show in foreground, surrounding skyscrapers creating urban canyon, dramatic upward perspective from below, night illumination with LED patterns, futuristic metropolis backdrop"
        ),
    ],
    "europe": [
        (
            "Eiffel Tower",
            "France",
            "Iron lattice tower with observation decks, Champ de Mars gardens with geometric flower beds, romantic evening with sparkling lights every hour, classic Parisian street lamps, Seine River glimpsed in background, blue hour sky transitioning to night, elegant Haussmann buildings nearby"
        ),
        (
            "Colosseum",
            "Italy",
            "Ancient elliptical amphitheater with partially ruined outer walls, multiple levels of arches in travertine stone, underground hypogeum visible through arena floor, warm Roman afternoon light, scattered tourists providing scale, adjacent Arch of Constantine, timeless Mediterranean atmosphere"
        ),
        (
            "Sagrada Familia",
            "Spain",
            "Gaudis unfinished basilica with towering organic spires, intricate facades depicting biblical scenes, construction cranes indicating ongoing work, vibrant stained glass casting rainbow light inside, Barcelona cityscape visible through openings, intricate stone carvings of nature motifs, modernist Catalan architecture"
        ),
        (
            "Neuschwanstein Castle",
            "Germany",
            "Romantic fairytale palace perched on forested mountain peak, white limestone walls with blue turrets, Marienbrucke bridge viewpoint over waterfall, alpine peaks in background with snow patches, misty morning atmosphere, Bavarian countryside rolling below, inspiration for Disney castle"
        ),
        (
            "Santorini",
            "Greece",
            "Whitewashed cubic buildings cascading down volcanic caldera cliffs, iconic blue-domed churches with white crosses, Aegean Sea stretching to horizon in deep blue, narrow winding staircases between houses, bougainvillea flowers in bright pink and purple, sunset golden light on west-facing terraces, Cycladic island architecture"
        ),
        (
            "Big Ben",
            "United Kingdom",
            "Victorian Gothic clock tower with massive four-faced timepiece, Palace of Westminster neo-gothic architecture beside, Westminster Bridge with red double-decker bus crossing, Thames River flowing calmly below, dramatic cloudy London sky, Big Ben name actually referring to the bell inside, iconic British landmark"
        ),
    ],
    "north_america": [
        (
            "Statue of Liberty",
            "USA",
            "Copper-green patina goddess holding torch aloft, New York Harbor with Manhattan skyline behind, crown with seven spikes representing continents, broken chains at feet symbolizing freedom, ferry boats in surrounding water, dramatic clouds over urban backdrop, Liberty Island greenery in foreground, Ellis Island visible nearby"
        ),
        (
            "Golden Gate Bridge",
            "USA",
            "International orange suspension bridge spanning strait, twin towers with Art Deco details, fog rolling through cables and deck, Marin Headlands rising on north side, sailboats passing underneath, Baker Beach providing foreground view, iconic San Francisco Bay setting, dramatic marine layer atmosphere"
        ),
        (
            "Chichen Itza",
            "Mexico",
            "El Castillo step pyramid with nine terraced levels, serpent shadow descending equinox staircase, ancient ball court with stone rings, tropical jungle surrounding archaeological site, bright Yucatan sunlight, Chac Mool reclining figure, Toltec and Mayan architectural fusion, sacred cenote nearby"
        ),
        (
            "Niagara Falls",
            "Canada",
            "Massive Horseshoe Falls with curtain of water plunging, mist rising hundreds of feet creating rainbows, observation tower on Canadian side, Maid of the Mist boats at base, lush green parklands surrounding, powerful water flow creating thunderous roar, border between Ontario and New York State"
        ),
        (
            "Grand Canyon",
            "USA",
            "Vast chasm with layered red rock strata visible, Colorado River winding through bottom mile below, Mather Point overlook with guardrails, dramatic shadows across canyon walls, pinyon pine trees at rim edge, Arizona desert landscape extending to horizon, geological time visible in rock layers, golden hour warm tones"
        ),
    ],
    "south_america": [
        (
            "Machu Picchu",
            "Peru",
            "Lost Incan citadel perched on mountain ridge above Sacred Valley, dry stone construction with perfectly fitted blocks, agricultural terraces stepping down slopes, Huayna Picchu peak towering behind, morning mist filling the valley below, llamas grazing on grass, Andes Mountains surrounding, mysterious ancient engineering"
        ),
        (
            "Christ the Redeemer",
            "Brazil",
            "Art Deco statue of Jesus with outstretched arms atop Corcovado mountain, overlooking Rio de Janeiro city and bay, Sugarloaf Mountain visible in distance, tropical Tijuca Forest surrounding base, clouds often swirling around the 98-foot figure, sunset creating dramatic silhouette, panoramic cityscape below"
        ),
        (
            "Easter Island",
            "Chile",
            "Moai stone statues with oversized heads lined up on Ahu platform, Rano Raraku volcano quarry in background, grassy Pacific island landscape, ocean waves crashing on shore, scattered wild horses grazing nearby, mysterious ancient Polynesian culture, dramatic cloud formations over isolated island"
        ),
        (
            "Angel Falls",
            "Venezuela",
            "Worlds tallest uninterrupted waterfall plunging from Auyan-tepui tabletop mountain, water cascading 979 meters into jungle below, mist creating perpetual rainbow effects, dense Canaima National Park rainforest surrounding, indigenous Pemon territory, tepui flat-topped mountain unique geology, remote Gran Sabana region"
        ),
        (
            "Salar de Uyuni",
            "Bolivia",
            "Vast white salt flat creating perfect mirror after rainfall, hexagonal salt crystal patterns on dry sections, distant cactus-covered Isla Incahuasi rising from plain, 4x4 vehicles providing scale perspective, blinding white expanse to horizon, Altiplano high altitude landscape, pink flamingos in nearby lagoons, extreme flatness creating surreal reflections"
        ),
    ],
    "africa": [
        (
            "Pyramids of Giza",
            "Egypt",
            "Ancient Egyptian pyramids with Great Pyramid of Khufu largest, Sphinx with lion body and human head guarding, desert sand dunes surrounding complex, Cairo city skyline visible in hazy distance, camel caravan silhouettes on ridge, golden sunset light on limestone blocks, necropolis of Fourth Dynasty pharaohs, Giza plateau archaeology"
        ),
        (
            "Victoria Falls",
            "Zimbabwe",
            "Local name Mosi-oa-Tunya meaning the smoke that thunders, massive curtain waterfall on Zambezi River, spray mist rising 400 meters creating micro-rainforest, rainbow arcs in afternoon light, Knife-Edge Bridge viewpoint getting visitors soaked, Batoka Gorge below, Livingstone Island where David Livingstone first viewed"
        ),
        (
            "Table Mountain",
            "South Africa",
            "Flat-topped mountain plateau with dramatic cliff edges, cable car ascending to summit with rotating floor, Cape Town city bowl nestled below, Twelve Apostles mountain range extending south, fynbos vegetation unique to region, clouds pouring over edge in tablecloth phenomenon, Atlantic Ocean on three sides, iconic African landmark backdrop"
        ),
        (
            "Mount Kilimanjaro",
            "Tanzania",
            "Dormant volcano with snow-capped Kibo summit at 5895 meters, Uhuru Peak highest point in Africa, surrounding savanna with acacia trees, Maasai village huts in foreground, clouds often obscuring peak creating mystery, alpine desert zone visible on slopes, equatorial location yet glaciers present, Kilimanjaro National Park"
        ),
        (
            "Sahara Desert Dunes",
            "Morocco",
            "Erg Chebbi golden sand dunes reaching 150 meters high, camel trek silhouettes crossing ridges, Berber tent camps with lanterns at night, orange and red sand changing color throughout day, Sahara stars and Milky Way visible at night, Merzouga village at edge, dramatic shadows on wind-sculpted ripples, largest hot desert world"
        ),
    ],
    "australia": [
        (
            "Sydney Opera House",
            "Australia",
            "Iconic performing arts center with white shell-like sail roofs, Sydney Harbour Bridge arching behind, Bennelong Point peninsula location, Royal Botanic Gardens in foreground, ferries crossing the harbor, modern expressionist architecture by Jorn Utzon, waterfront promenade with visitors, New South Wales landmark at twilight"
        ),
        (
            "Uluru",
            "Australia",
            "Massive sandstone monolith rising 348 meters from flat desert, sacred Anangu Aboriginal site, iron oxide giving rust-red color, Kata Tjuta domes visible in distance, sunset changing rock through spectrum of reds to purple, no climbing ropes visible respecting indigenous wishes, spinifex grass and desert oaks at base, Red Centre of Northern Territory"
        ),
        (
            "Great Barrier Reef",
            "Australia",
            "Worlds largest coral reef system visible from space, tropical fish swimming among colorful coral formations, Heart Reef naturally shaped coral formation, clear turquoise water with high visibility, Whitsunday Islands white sand beaches nearby, snorkeler or glass-bottom boat for scale, Queensland coastal waters, marine biodiversity hotspot"
        ),
        (
            "Twelve Apostles",
            "Australia",
            "Limestone sea stacks rising from Southern Ocean waves, Great Ocean Road winding along cliff tops, Gibson Steps beach providing access to base, golden limestone catching sunset light, only eight stacks remaining from original twelve, Port Campbell National Park rugged coastline, koalas in nearby eucalyptus trees, dramatic coastal erosion landscape"
        ),
        (
            "Hobbiton",
            "New Zealand",
            "Movie set from Lord of the Rings with round hobbit holes in hillside, thatched-roof cottages with colorful doors, Party Tree in center of green rolling landscape, Bag End location with iconic circular door, Hobbiton Movie Set maintained for tourism, sheep grazing on lush Waikato farmland, Party Field with lake and Green Dragon Inn replica"
        ),
    ],
    "antarctica": [
        (
            "Penguin Colony",
            "Antarctica",
            "Thousands of Emperor penguins huddled on ice, chicks with gray fluffy plumage among adults, ice floes and bergs in background, dramatic white and black contrast against snow, Antarctic Peninsula mountains in distance, midnight sun during summer creating 24-hour daylight, Weddell Sea remote location, pristine frozen wilderness"
        ),
        (
            "Iceberg Alley",
            "Antarctica",
            "Massive tabular icebergs with flat tops and vertical sides, vivid blue ice compressed over millennia, penguins and seals resting on smaller bergs, Lemaire Channel narrow passage between cliffs, Pleneau Bay graveyard of icebergs grounded in shallows, zodiac boats for scale showing massive size, crystal clear Antarctic waters, sculptural ice formations"
        ),
        (
            "Mount Erebus",
            "Antarctica",
            "Southernmost active volcano with persistent lava lake steaming, Ross Island location near McMurdo Station, snow-covered cone with fumaroles venting smoke, ice towers formed by volcanic gases, extreme cold environment with volcanic heat contrast, Transantarctic Mountains backdrop, research station buildings at base, Deception Island similar geothermal site"
        ),
        (
            "Paradise Harbour",
            "Antarctica",
            "Protected bay with mirror-calm waters reflecting ice-covered mountains, Argentine research station Almirante Brown on hillside, gentoo penguins on rocky outcrops, zodiac cruising through brash ice, glaciers calving into bay with thunderous sound, Gerlache Strait location, snow-covered peaks surrounding on three sides, whale spotting in summer waters"
        ),
        (
            "Lemaire Channel",
            "Antarctica",
            "Narrow seven-mile passage between steep mountain cliffs, sometimes impassable due to ice blocking, dramatic vertical rock faces with snow patches, reflection photography hotspot when water still, Booth Island on one side and Peninsula on other, named after Belgian explorer, Kodak Gap nickname for stunning views, icebreaker ship navigating passage"
        ),
    ],
}

# Unique style variations - no framing elements, completely distinct approaches
STYLE_VARIATIONS = [
    "ultra high resolution 8k clarity with photorealistic textures",
    "cinematic color grading with teal shadows and amber highlights",
    "HDR processing revealing details in darkest shadows and brightest highlights",
    "soft dreamy atmosphere with pastel tones and gentle contrast",
    "vibrant saturated colors with enhanced luminosity and depth",
    "dramatic chiaroscuro lighting with bold shadows and glowing highlights",
    "ethereal misty ambiance with muted tones and subtle mystery",
    "crisp documentary style with true-to-life color accuracy",
    "golden hour warmth with enhanced earth tones and rich saturation",
    "cool arctic palette with blue undertones and crystalline clarity",
    "vintage film aesthetic with grain texture and nostalgic tones",
    "modern minimalist composition with clean lines and negative space",
    "romantic soft focus foreground with razor sharp subject detail",
    "tropical vibrancy with aqua blues and lush emerald greens",
    "dramatic storm light with dark clouds and sunbeam breakthrough",
    "moonlit night scene with subtle blue illumination and star details",
    "desert heat shimmer with warm oranges and mirage-like atmosphere",
    "alpine crispness with pure whites and sharp mountain air clarity",
    "editorial fashion lighting with dramatic contrast and polish",
    "natural untouched wilderness feel with organic imperfections",
]

# Unique technical approaches - completely different for each image
TECHNICAL_APPROACHES = [
    "shot from low angle looking upward emphasizing monument scale and grandeur",
    "captured from elevated viewpoint showing relationship to surrounding landscape",
    "intimate detail focus on unique architectural elements and textures",
    "wide establishing shot including environmental context and setting",
    "dramatic diagonal composition creating dynamic visual tension and energy",
    "perfect symmetrical framing highlighting geometric harmony and balance",
    "off-center subject placement using rule of thirds for visual interest",
    "reflection capture utilizing water surface for mirror image symmetry",
    "foreground interest layer with out-of-focus elements leading to subject",
    "extreme telephoto compression flattening perspective and isolating subject",
    "vast negative space emphasizing isolation and monumental scale",
    "immersive close-up filling frame with intricate patterns and details",
    "layered depth composition with multiple planes receding into distance",
    "dramatic perspective distortion from ultra-wide angle lens",
    "environmental portrait showing subject as part of broader ecosystem",
    "aerial viewpoint revealing patterns and layout invisible from ground",
    "through-the-window or natural frame using existing structures",
    "street-level human perspective showing how visitors experience site",
    "silhouette technique with subject backlit against bright sky",
    "panoramic wide view capturing full breadth of expansive scene",
]

def sanitize_filename(name: str) -> str:
    return name.lower().replace(" ", "_").replace("-", "_") + ".txt"

def create_folder_structure() -> None:
    for continent in LANDMARK_PROMPTS.keys():
        continent_path = OUTPUT_DIR / continent
        continent_path.mkdir(parents=True, exist_ok=True)
        print(f"Created: {continent_path}")

def generate_prompt_files() -> List[Dict[str, str]]:
    metadata = []
    used_styles = set()
    used_technical = set()
    
    for continent, landmarks in LANDMARK_PROMPTS.items():
        for landmark_data in landmarks:
            name, country, description = landmark_data
            filename = sanitize_filename(name)
            filepath = OUTPUT_DIR / continent / filename
            
            # Get unique style not yet used
            available_styles = [s for s in STYLE_VARIATIONS if s not in used_styles]
            if not available_styles:
                used_styles.clear()
                available_styles = STYLE_VARIATIONS
            style = random.choice(available_styles)
            used_styles.add(style)
            
            # Get unique technical approach not yet used
            available_technical = [t for t in TECHNICAL_APPROACHES if t not in used_technical]
            if not available_technical:
                used_technical.clear()
                available_technical = TECHNICAL_APPROACHES
            technical = random.choice(available_technical)
            used_technical.add(technical)
            
            # Build unique prompt
            base = f"Ultra realistic professional travel photograph of {name}, {country}. {description}. {style}. {technical}."
            ending = " Portrait orientation optimized for jigsaw puzzle with clear subject visibility, no people, no text. Make sure if some elements from the above prompt is similar to the previous one, have different things and different style and content."
            
            final_prompt = base + ending
            
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(final_prompt)
            
            print(f"Generated: {filepath}")
            
            metadata.append({
                "file": str(filepath),
                "place": name,
                "country": country,
                "continent": continent,
            })
    
    return metadata

def generate_metadata(metadata: List[Dict[str, str]]) -> None:
    metadata_path = OUTPUT_DIR / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"Generated: {metadata_path}")

def main() -> None:
    print("=" * 60)
    print("Puzzle Prompt Generator - Unique Handcrafted Descriptions")
    print("=" * 60)
    
    create_folder_structure()
    metadata = generate_prompt_files()
    generate_metadata(metadata)
    
    print("=" * 60)
    print(f"Complete! Generated {len(metadata)} unique prompt files.")
    print("=" * 60)

if __name__ == "__main__":
    main()
