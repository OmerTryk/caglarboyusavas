# Çağlar Boyu Savaş

Taş Çağı'ndan Gelecek Çağ'a uzanan, tek şeritte oynanan bir strateji savaşı. Klasik Flash oyunu *Age of War*'dan esinlenir ama kendi mekanikleriyle gelir. Grafikler piksel sanatı tarzındadır ve tamamı kodla üretilir, ayrı bir görsel dosyası yoktur. Sahne 720×224'lük küçük bir tuvale çizilir, sonra pikseller bulanıklaşmadan ekran boyutuna büyütülür.

## Neler var?

- **6 çağ:** Taş, Antik, Orta, Barut, Modern ve Gelecek. Her çağın 4 birimi, 2 kulesi ve kendine özgü bir gücü var. Son çağda bir de efsanevi **Titan** birimi açılıyor.
- **Karşı-birim halkası:** Piyade › Menzilli › Zırh Delici › Ağır › Piyade. Bir birimin güçlü olduğu türe vuruşu sarı rakamla gösterilir.
- **Ordu komutları:** Saldır, Tut ve Geri Çekil. Tut ile askerlerini orta hatta topla, sonra hepsiyle birden saldır.
- **Hedefli çağ gücü:** Gücü savaş alanında istediğin noktaya düşürürsün. **Savaş Davulu** ise ordunu kısa süreliğine güçlendirir.
- **Çağ atlama şok dalgası:** Yeni çağa geçtiğinde üssün yakınındaki düşmanları geri savurur.
- **Terfi:** Düşman öldüren birim yıldız kazanır ve güçlenir.
- **Erzak sandıkları:** Savaş alanının ortasına paraşütle iner. İlk ulaşan taraf altını alır.
- **Kıyamet Saati:** 25. dakikadan sonra üslere verilen hasar her dakika artar, böylece maçlar sonsuza kadar sürmez.
- **Oyun ayarları:** ×1/×2/×3 hız, duraklatma, 4 zorluk seviyesi.
- **Menü arka planı:** Ana menünün arkasında iki yapay zekâ canlı olarak birbiriyle savaşır.

## Geliştirme

```bash
npm install
```

```bash
npm run dev
```

Testler, denge testlerini de kapsar (yapay zekâlar birbirine karşı oynar, maçların bitip bitmediği ve çağların ilerleyip ilerlemediği kontrol edilir):

```bash
npm test
```

```bash
npm run build
```

## Vercel'e yayınlama

Proje statik bir Vite + React uygulaması. Ayarlar `vercel.json` dosyasında hazır.

1. Projeyi bir GitHub deposuna gönder.
2. Vercel'de **Add New → Project** ile depoyu içe aktar. Framework otomatik olarak *Vite* seçilir, başka bir ayar gerekmez.
3. Bundan sonra her `git push` otomatik olarak yeniden yayınlanır.

Ya da Vercel CLI ile doğrudan yayınla:

```bash
npx vercel --prod
```

## Kod yapısı

```
src/
  sim/       Oyun mantığı. React'e ve tarayıcıya bağımlı değil; aynı tohumla her seferinde aynı sonucu verir.
    data.ts    Çağlar, birimler, kuleler ve denge sabitleri
    world.ts   Simülasyon adımı ve komutlar
    ai.ts      Yapay zekâ rakip
  render/    Piksel sanatı çizimi
    pixel/     Kenar yumuşatmasız mini çizim motoru (Painter), renk yardımcıları
    sprites/   Birim, üs, kule ve küçük nesne sprite'ları (önbellekli)
    background.ts  Her çağ için ditherlı (noktalı geçişli) piksel manzara
    renderer.ts    Düşük çözünürlüklü sahne, efektler, ekrana keskin büyütme
  game/      Sabit adımlı oyun döngüsü
  ui/        React arayüzü: menü, HUD, sonuç ekranı
tests/       Simülasyon ve denge testleri
```

Dengeyi değiştirmek için önce `src/sim/data.ts` dosyasındaki sabitlere bak. Ardından `npm test` ile yapay zekâ maçlarının hâlâ makul sürede bittiğini kontrol et.
