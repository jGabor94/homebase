# Homebase design

Frissítve: 2026-10-12. Az aktuális design a .agents/app-design 11 desktop- és mobilreferenciájából készült. Részletes követelmények és referencia-hozzárendelések: [alkalmazásszintű redesign](../src/docs/engineering/active/app-redesign.md).

## Vizuális rendszer

Világos, nyugodt családi alkalmazás petrol navigációval, erős Geist sans címekkel, pasztell funkciókártyákkal és külön otthonillusztrációkkal. A korábbi krém–barna–olíva és Georgia téma lecserélve.

- Vászon #f7f9fa, panel #ffffff, fő szöveg #0b1628, másodlagos #586b85, határ #e3e9ee.
- Petrol primary #126574, meleg hangsúlyos művelet #b34330, sötét sidebar #10252d, aktív menü #194b55.
- Víz: kék, gáz: korall, villany: sárga, hulladék: zöld; a szín mellett ikon/felirat is szerepel.
- Szemantikus shadcn változók és Tailwind v4 theme mapping a src/app/globals.css fájlban; JSX utility classok az oldalakban és komponensekben.
- Sans oldalcím 32–60 px, panelcím 18–24 px, törzsszöveg 15–16 px; tabular pénzösszegek magyar formátumban.
- Panelek 18–24 px lekerekítéssel, finom kerettel és árnyékkal; 16–24 px belső/rácstérköz.
- Enyhe petrol gradient és illusztrált háttér megengedett, glassmorphism és túlzott animáció nem szükséges.

## Navigáció és oldalak

1024 px-től közös sötét shadcn sidebar, világos felső kereső/dátum/profil sáv. Kisebb képernyőn logó/kereső/profil fejléc és fix, jogosultságszűrt alsó navigáció, safe-area-val. Menüpontok és aktív URL-logika egy közös definícióból származnak. Kijelentkezés mobilon a profilmenüből is elérhető.

A landing statikus, osztott hero és HTML-alapú fiktív appelőnézet; mobilon egymás alatti elemek. A login csak Google-belépés. A dashboard valódi mentett közműadatokat, ismert határidőket és jogosultan olvasható jegyzeteket mutat. A hiányzó adat nem nulla, a fizetési határidő nem fizetettség.

Közművek: kategória/metrika/6–12 hónap választó, KPI és diagram, mentett hónaplista; külön havi szerkesztő, számlakártyák és összegzés. Mobilon az egész összegző panel nem rögzített: rövid alsó műveletsáv nyitja meg és kínál mentést.

Jegyzetek: illusztrált fejléc, valódi teljeshalmaz-keresés/szűrés/rendezés/count, grid/lista, stabil pasztell kártyák. 480 px alatt olvasható egyoszlopos rács. Desktopon széles, kétoszlopos szerkesztő; mobilon teljes képernyő, külön görgethető tartalommal és mentési sávval. A privát/családi jelölés külön felirat, nem kártyaszín.

## Működés és hozzáférhetőség

A felület valódi HTML; a referencia screenshot nem helyettesít formot, diagramot vagy navigációt. Az eredeti képek személyes adatai nem kerülnek publikus assetbe. Az illusztrációs források: [assetjegyzék](../src/docs/engineering/active/app-redesign-assets.md).

Magyar dokumentumnyelv, egy h1, szemantikus nav/main/section, skip link, billentyűzetes vezérlés és látható fókusz. Interaktív célterület legalább 44 px. Dialogok fókuszkezeléssel; diagramok szöveges adattáblával. Mobil alsó nav és műveletsáv nem takarhat mezőt. Csökkentett mozgás mellett statikus megjelenés.

Keresés, dashboard és feature UI megtartja a DAL-jogosultságvédelmet. A mentetlen szerkesztés eldobása megerősítést kér a belső navigáció során. A címkék, emlékeztetők, képcsatolás és értesítések külön tervezett bővítések; működésük nélkül vezérlő vagy piros harangbadge nem jelenik meg.
