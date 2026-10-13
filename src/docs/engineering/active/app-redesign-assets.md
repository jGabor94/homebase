# Redesign illusztrációk

Dátum: 2026-10-13. A fejléc- és landingillusztrációk a beépített imagegen eszközzel készített, széles 3:1 kompozíciók. Az oldalsáv egyszerű, vektoros levélágat használ a desktop mintaképek szerint. A korábbi projektasseteket a felhasználó kérésére eltávolítottuk.

| Asset a `public/images/homebase` alatt | Méret | Alkalmazás |
| --- | --- | --- |
| `home-wide.webp` | 1800 × 600 | Áttekintés, közművek, landing, login |
| `notes-wide.webp` | 1800 × 600 | Jegyzetek, beállítások |
| `living-wide.webp` | 1800 × 600 | Landing nappali szekció |
| `sidebar-leaves.svg` | 92 × 104 | Sidebar kártya jobb alsó sarka; kézzel rajzolt petrol levélág |

A WebP-fájlok sharp átméretezéssel, 85-ös minőséggel készültek. A ház és az íróasztal környezete transzparens; a nappali teljes felületű festmény. A generált PNG-források a Codex generated_images könyvtárában maradtak.

Az app fejlécei egységesen a jóváhagyott széles elrendezést használják: 640 px-től teljes színerő, ez alatt 25%-os opacitás a szöveg olvashatóságáért. 1280 px alatt a kép bal oldali 30%-án fut átmenet, felette nincs CSS-maszk. A landing és a login a valós 3:1 méretekkel jeleníti meg a házat. A nappali teljes szélességben, vágás nélkül látható; a sidebar levélága abszolút pozícióval a kártya jobb alsó sarkába került, külön képsor nélkül. A leírás keskenyebb szöveghasábja helyet hagy a dekorációnak.

## Generálási promptok

### home-wide.webp

Reference: original home.webp. Preserve the same cream family home, blue solar panel roof, warm sunlight, watercolor style and colors. Extend the composition horizontally with a lush garden, low shrubs, trees, lawn and a short garden path. Panoramic 3:1 canvas; house in the right half. Keep the central house and garden fully colored, with transparent exterior and only narrow soft watercolor feathering at the outer edges. No typography, border, UI or logos.

### notes-wide.webp

Edit target: reference notes.webp. Recompose as a panoramic 3:1 watercolor illustration for a website header. Keep the open blank notebook, teal pen, cream coffee mug, green trailing plant and warm sunlit window. Extend the wooden desktop and window horizontally, with notebook, mug and plant predominantly in the right half. Preserve the cozy editorial watercolor colors and material details. Strong clear colors throughout the center, no broad washed-out fade. Transparent outside the painted silhouette, with only narrow softly feathered outer edges. No writing, UI, logo, people or watermark.

### living-wide.webp

Edit target: reference living.webp. Create a panoramic 3:1 version of this warm sunlit Scandinavian living room watercolor illustration. Preserve the cream sofa, petrol cushions, wooden tables, lush green plants, big sunlit window and a single golden dog sleeping on the rug. Extend the room horizontally with natural perspective, not stretched objects. Balanced full-width composition with every subject intact. Fully colored edge-to-edge rectangular painting with no fading, no transparency, no blank margin. No text, UI, logos, people or watermark.

### sidebar-leaves.svg

Nem generált bitmap: a `.agents/app-design/home desktop.png` és `notes desktop 1.png` kártyáját követő, egyszerű tompa petrol levélág. Nincs cserép vagy vízszintes növénysáv.

## Ellenőrzés

A módosított kód és képhivatkozások logikai átnézése megtörtént. A kisebb UI-módosításokra vonatkozó repository-szabály szerint nem indult automatikus teszt, lint, build vagy böngészős ellenőrzés.
