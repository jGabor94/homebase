# Ellenőrzés
Ne futtass automatikusan buildet, lintet, typechecket vagy teszteket minden feladat végén.
  A követekző esetekben futtass buildet:
1. a felhasználó kifejezetten kéri.
  2. git push előtt mindig
3. nagy komplex feladatok után

  Egyéb ellenőrzés:

- UI böngészős ellenőrzést csak komplex design implementáció esetén ellenőrizz
- elsődlegesen böngészőben ellenőrizd a megjelenést és a konzolhibákat;
- szükség esetén csak a módosított fájlokat linteld;
- csak akkor futass elleőrzést ha alapos okod van feltételezni, hogy a módosítás ilyen hibát okozhat.
  - FONTOS! Commit előtt mindeképp futass lintet és typescheck - et. (Buildet ilyenkor sem kell)

Kisebb UI -, CSS -, szöveg - vagy egyszerű komponensmódosítások után ne futtass automatikus ellenőrzéseket.Ilyenkor feltételezd, hogy a fejlesztői szerver fut, és elegendő a módosított kód logikai ellenőrzése.