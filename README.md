# NotTerra 🌸

Osobní web s odkazy (v angličtině) – noční pixel-art scéna se starou japonskou pagodou, horou Fuji,
kvetoucí sakurou, lucernami a animovanou červenou pandou.

- Celá scéna se kreslí v prohlížeči (canvas), žádné velké obrázky → rychlé načtení.
- Panda dýchá, mrká, hýbe ocasem i ušima, sleduje kurzor, dá se pohladit (srdíčka) a kliknout (skočí).
  Když se dlouho nic neděje, usne 💤.
- Efekty myši: světlo a jiskry za kurzorem, lístky sakury uhýbají pohybu myši,
  klik do scény vyfoukne lístky, světlušky letí za kurzorem, paralaxa vrstev, náklon karet.
- Tlačítko „effects" v patičce vypne náročnější efekty (pro slabší zařízení).
  Respektuje i systémové nastavení „omezit pohyb".

## Struktura

```
public/              ← to, co se nasazuje
  index.html         ← profil + odkazy (tady se mění texty a odkazy)
  css/style.css      ← vzhled karet
  js/main.js         ← ovládání, bublina pandy (hlášky v LINES)
  js/scene.js        ← pixel-art scéna, světla, částice
  js/panda.js        ← sprite červené pandy
  js/util.js         ← pomocné funkce
  assets/            ← fonty, kurzory
  _headers           ← HTTP hlavičky pro Cloudflare Pages
```

## Přidání / úprava odkazu

V `public/index.html` zkopíruj jeden blok `<li>…</li>` v seznamu odkazů a změň:
`href`, barvu `--c`, pořadí `--i`, ikonu (`<svg>`), název (`<strong>`) a text odkazu (`.url`).

## Nasazení na Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → záložka **Pages** → **Connect to Git**.
2. Vyber repozitář `NotTerraCZ/notterra`.
3. Nastavení buildu:
   - **Production branch:** `main` (nebo větev, ze které chceš nasazovat)
   - **Framework preset:** `None`
   - **Build command:** *(nech prázdné)*
   - **Build output directory:** `public`
4. **Save and Deploy**. Každý další push do produkční větve web automaticky aktualizuje,
   ostatní větve dostanou vlastní náhledovou (preview) adresu.
5. Vlastní doménu přidáš v projektu v záložce **Custom domains**.

## Lokální náhled

Web je čisté HTML/CSS/JS bez buildu – stačí statický server:

```bash
npx serve public
# nebo
python3 -m http.server 8080 --directory public
```

(Otevření `index.html` přímo ze souboru nefunguje kvůli JS modulům.)

## Licence fontů

Pixelify Sans a DotGothic16 jsou pod SIL Open Font License 1.1 (viz `public/assets/fonts/`).
