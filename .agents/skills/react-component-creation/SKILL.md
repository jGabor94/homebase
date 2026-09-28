# React komponens létrehozása

Ezt a skillt React  fájl létrehozásakor vagy komponensek átszervezésekor használd.


## Komponensfájlok felépítése

Egy fájlban csak egy React komponens legyen.

Kerüld a felduzzadt fájlokat. A komponenseket szükség esetén bontsd kisebb alkomponensekre, és szervezd őket külön fájlokba.

A kiszervezés különösen indokolt, ha egy frontend rész ismétlődést mutat.

Az összetartozó komponenscsoportok, például egy navbar és annak alkomponensei, saját mappába kerüljenek.

A komponenscsoport belépési pontja:

```text
index.tsx
```

## React komponensek elnevezése

A React komponensek fájlneve mindig PascalCase formátumú legyen.

A fájlnév:

* nagybetűvel kezdődjön;
* ne tartalmazzon kötőjelet (`-`);
* ne tartalmazzon aláhúzást (`_`);
* ne tartalmazzon szóközt.

A komponens neve egyezzen meg a fájlnévvel.

Példa:

```text
ProfileHeader.tsx
```

## Komponens deklarálása és exportálása

A React komponenseket default exporttal exportáld.

A komponens típusához használd a React `FC` típusát.

```tsx
import { FC } from "react";

const ExampleComponent: FC<{}> = () => {
  return <></>;
};

export default ExampleComponent;
```
