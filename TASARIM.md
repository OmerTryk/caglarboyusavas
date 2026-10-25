# Çağlar Boyu Savaş — Araştırma, Tasarım ve Yol Haritası

> Durum: Taslak v0.1 (2026-10-24). Kararı sana bırakılan noktalar en sonda **Açık Sorular** bölümünde.

> **Uygulama notu (v0.1 kodu):** Vercel'de statik olarak yayınlanabilmesi için teknoloji Phaser yerine **React + TypeScript + Vite + Canvas 2D** olarak değiştirildi. Simülasyon `src/sim/` altında React'ten bağımsız ve deterministik çalışıyor. Bu sürümde 7 değil **6 çağ** var. Faz 1–3'ün büyük kısmı tamamlandı: karşı-birim halkası, ordu komutları, hedefli güç, Savaş Davulu, terfi, erzak sandığı, çağ şok dalgası, Titan, 4 zorluk ve Kıyamet Saati. Henüz yapılmayanlar: yükseltme ağacı, ses, kampanya ve diğer modlar, kayıt sistemi. Güncel denge değerleri `src/sim/data.ts` dosyasında; 7. bölümdeki tablo yalnızca ilk taslak.

---

## 1. Orijinal oyun: ne yapıyordu?

"Çağlar Boyu Savaş", Türk oyun sitelerinde **Age of War** (Max Games / Louissi, 2007, Flash) adıyla bilinen oyunun Türkçe adı. 2D yandan görünüm, tek şerit (lane), iki üs karşı karşıya.

### Çekirdek döngü
1. Altınla birim üret → birimler kendiliğinden düşmana yürür.
2. Düşman birimi öldür → **altın + XP** kazan (kendi birimin ölünce de biraz XP gelir).
3. XP eşiğine ulaş → **çağ atla** (yeni birimler, kuleler, üs görünümü, özel güç).
4. Altınla **kule** ve **kule yuvası** satın al.
5. Bekleme süreli (~40–45 sn), bedava **özel güç** kullan (gökten taş, ok yağmuru, bomba…).
6. Karşı üssün canını sıfırla → kazan.

### Orijinal veriler (Normal zorluk, topluluk kaynakları — yaklaşık)

| Çağ | Gerekli XP | Birimler (altın) | Kuleler (altın) | Özel güç |
|---|---|---|---|---|
| Taş | 0 | Sopalı 15 · Sapancı 25 · Dino binici 100 | Taş sapanı 100 · Yumurta otomatiği 200 · İlkel mancınık 500 | Taş yağmuru |
| Orta Çağ | 4.000 | Kılıççı 50 · Okçu 75 · Şövalye 500 | Mancınık 500 · Ateş mancınığı 750 · Kızgın yağ 1.000 | Ok yağmuru |
| Rönesans | 14.000 | Düellocu 200 · Tüfekli 400 · Topçu 1.000 | Küçük top 1.500 · Büyük top 3.000 · Patlayıcı top 6.000 | "Kutsal ruh" |
| Modern | 80.000 | Piyade 1.500 · Tüfekli piyade 2.000 · Tank 7.000 | Tek namlu 7.000 · Roket 9.000 · Çift namlu 14.000 | Bombardıman |
| Gelecek | 200.000 | Kılıç 5.000 · Blaster 6.000 · Savaş makinesi 20.000 · **Süper asker 150.000** | Titanyum 24.000 · Lazer 40.000 · İyon ışını 100.000 | Yıldırım bombası |

Gözlem: birim maliyeti çağ başına **~3–4 kat**, XP eşiği **~3–5 kat** artıyor. Her çağda 3 rol var: **yakın dövüş / menzilli / ağır**.

### Age of War 2'nin getirdikleri (devam oyunu)
- 7 çağ, çağ başına **4 birim** ve dönen bir **karşı-birim (counter) halkası**: Piyade > Destek > Zırh-delici > Ağır > Piyade.
- **Kalıcı yükseltmeler** (birim / kule / üs statları).
- Birden fazla **küresel büyü** (meteor, şimşek fırtınası, bombardıman uçakları).
- **Generaller modu**: farklı taktikli 10 yapay zekâ rakip.
- 4 zorluk seviyesi, başarımlar.

### Bilinen zayıflıklar (eleştiriler + oyuncu deneyimi)
| Sorun | Neden kötü | Bizim çözümümüz |
|---|---|---|
| Birimler tek sıra, birebir dövüşüyor; ortada bekleşiyorlar | Tempo yavaş, izlemek sıkıcı | Ön hat genişliği, alan hasarı, menzillilerin arkadan ateşi, oyun hızı ×1/×2/×3 |
| Çağ atlama butonu fark edilmiyor | Oyuncu fırsatı kaçırıyor | Belirgin bildirim + ses + parlayan buton |
| Oyuncunun ordu üzerinde kontrolü yok | Strateji sadece "ne üreteyim" | **Ordu komutları**: Saldır / Tut / Geri çekil |
| Son çağda "3 iyon ışını kur, bekle" baskın strateji | Oyun çözülüyor | Kule bakım maliyeti / kule hedeflerinin sınırı, düşman kuşatma birimleri |
| Tek mod, tek harita | Tekrar oynanabilirlik düşük | Kampanya, Hayatta Kalma, Günlük Meydan Okuma, farklı haritalar |

---

## 2. Vizyon

> **"Age of War'un sade, anında anlaşılan çekirdeğini koru; altına derin bir strateji katmanı, üstüne modern görsellik ve tekrar oynanabilirlik ekle."**

Tasarım ilkeleri:
1. **30 saniyede öğrenilir.** Tek şerit, birkaç buton. Derinlik sonradan açılır.
2. **Her an bir karar var.** Biriktir mi harca mı, çağ mı atla kule mi al, saldır mı savun.
3. **Çağ atlamak bir ödül anı.** Ekran dönüşür, müzik değişir, üs evrimleşir.
4. **Veri güdümlü.** Tüm birim/kule/çağ değerleri JSON dosyalarında; denge kodu değiştirmeden ayarlanır.

---

## 3. Oyun tasarımı (geliştirilmiş sürüm)

### 3.1 Çağlar (öneri: 7 çağ)
1. **Taş Çağı** — sopa, sapan, mamut binici
2. **Antik Çağ** — mızraklı, okçu, savaş arabası
3. **Orta Çağ** — kılıççı, arbaletçi, şövalye
4. **Barut Çağı** — yeniçeri tarzı tüfekli, süvari, top
5. **Sanayi / Dünya Savaşları** — piyade, keskin nişancı, tank
6. **Modern** — özel kuvvet, roketatar, helikopter
7. **Gelecek** — robot, lazer, mekanik dev

(Türk/Osmanlı tarihinden dokunuşlar bir tema seçeneği olabilir — bkz. Açık Sorular.)

### 3.2 Birim rolleri ve karşı-birim halkası
Çağ başına 4 birim + son çağda 1 "efsanevi" birim:

| Rol | Güçlü olduğu | Zayıf olduğu | Örnek |
|---|---|---|---|
| Piyade (yakın) | Destek | Ağır | Kılıççı |
| Destek (menzilli) | Zırh-delici | Piyade | Okçu |
| Zırh-delici | Ağır | Destek | Mızraklı / roketatar |
| Ağır | Piyade | Zırh-delici | Şövalye / tank |

Uygulama: her birimin `armorType` ve `damageType` alanı var; hasar = taban × çarpan (güçlü 1.5, zayıf 0.67). Halka sayesinde "hep en pahalıyı bas" stratejisi çöker.

### 3.3 Birim istatistikleri (veri şeması)
```
id, age, role, cost, buildTime, hp, damage, attackInterval, range,
moveSpeed, width, armorType, damageType, splash, goldBounty, xpBounty
```

### 3.4 Savaş modeli
- Şerit 1 boyutlu (x ekseni). Her birimin bir **genişliği** var; aynı taraftaki birimler arka arkaya dizilir.
- **Ön hat:** öndeki 1–2 yakın dövüşçü aynı anda savaşabilir (orijinaldeki "tek kişi dövüşür, gerisi bekler" sorununa çözüm).
- Menzilli birimler arkadan, menzilleri yettiği ilk düşmana ateş eder.
- Ağır birimler ve bazı kuleler **alan hasarı** verir → yığılmanın bedeli.
- Sabit zaman adımlı (ör. 60 Hz) **deterministik simülasyon**: tekrar izleme, denge testi ve ileride çevrimiçi PvP için şart.

### 3.5 Ekonomi
- **Öldürme ödülü** (orijinaldeki gibi) + küçük **pasif gelir** (ör. saniyede 2–5 altın, çağla artar) → hiç birimi kalmayan oyuncu kilitlenmez.
- **Üretim kuyruğu**: en fazla 5 birim; her birimin üretim süresi var.
- **Çağ atlama** XP ile; ayrıca **altınla da hızlandırılabilir** (opsiyonel risk/ödül kararı).

### 3.6 Kuleler
- Üste 1 bedava yuva + satın alınabilir 3 yuva daha (fiyatı artan).
- Çağ başına 3 kule: tek hedef hızlı / alan hasarı / yavaşlatma-destek.
- Kule satılabilir (%50 iade).
- Baskın strateji önlemi: kuleler menzil içindeki **sınırlı sayıda** hedefe vurur; geç çağlarda düşmanın **kuşatma birimleri** kulelere ekstra hasar verir.

### 3.7 Özel güçler
- Her çağın bir ana gücü (orijinal tarzı, bedava, ~45 sn bekleme).
- Ek olarak **XP ile açılan 2 yardımcı güç** (ör. "Moral: 10 sn +%30 hız", "Onarım: üs +%15 can").
- Hedefli kullanım: oyuncu gücü şeridin neresine düşüreceğini seçer.

### 3.8 Ordu komutları (en büyük yenilik)
Tek tuşla tüm orduya:
- **Saldır** — düşman üssüne yürü (varsayılan)
- **Tut** — belirli bir çizgide bekle, birik
- **Geri çekil** — üssün önüne, kulelerin korumasına dön

Bu, "ne üretiyorum"a ek olarak "ne zaman vuruyorum" kararını ekler (Stick War'un en sevilen mekaniği).

### 3.9 Yükseltmeler
Her çağda XP/altınla alınan kalıcı (o maç için) yükseltmeler:
- Birim hasarı / canı (+%10 kademeli)
- Kule menzili / atış hızı
- Üs zırhı, pasif gelir

### 3.10 Komutan / Kahraman (Faz 4, opsiyonel)
Maç başında seçilen tek bir kahraman birimi: ölürse belirli sürede yeniden doğar, çağla birlikte görünüm değiştirir, kendi yeteneği vardır.

### 3.11 Yapay zekâ rakip
- Karar döngüsü her ~0,5 sn: altın durumu, sahadaki birlik dengesi, oyuncunun kompozisyonu (karşı-birim seçimi), çağ atlama zamanı.
- **Kişilikler** (AoW2 generalleri gibi): *Saldırgan* (erken baskı), *Kaplumbağa* (kule ağırlıklı), *Teknolojist* (hızlı çağ atlar), *Dengeli*.
- Zorluk: Kolay / Normal / Zor / İmkânsız — AI'ın gelir çarpanı ve tepki süresiyle ayarlanır.

### 3.12 Oyun modları
| Mod | Açıklama | Faz |
|---|---|---|
| Hızlı Maç | Tek harita, AI'a karşı, zorluk seç | 1–2 |
| Kampanya | 7 çağ boyunca ~15 bölüm, her biri özel kural/harita, yıldız sistemi | 4 |
| Hayatta Kalma | Sonsuz dalga, skor tablosu | 4 |
| Günlük Meydan Okuma | Rastgele kurallar ("sadece menzilli", "çift hız") | 5 |
| Yerel 2 kişi / Çevrimiçi PvP | Deterministik simülasyon sayesinde mümkün | 6 (opsiyonel) |

### 3.13 Kontroller ve arayüz
- Alt panel: 4 birim butonu (maliyet + kısayol 1–4), kule butonları, özel güç, çağ atla.
- Üst bar: altın, XP çubuğu (bir sonraki çağa ne kaldı), iki üssün can çubuğu.
- Klavye kısayolları, fare/dokunmatik destek, oyun hızı ×1/×2/×3, duraklat.
- Kamera: şerit ekrandan genişse yatay kaydırma + mini harita.

---

## 4. Görsel ve ses yönü

- **Stil önerisi:** temiz, kalın hatlı 2D çizgi film (vektör) veya modern piksel sanatı. Her çağda **paralaks arka plan** değişir (mağaralar → kale → savaş alanı → şehir → uzay üssü).
- Üs, çağla birlikte **evrimleşir** (mağara → kale → tabya → bunker → kubbe).
- Juice: vuruş titremesi, hasar sayıları, parçacıklar, ekran sarsıntısı (özel güçlerde), ölüm animasyonları.
- Ses: çağa göre değişen müzik katmanları; çağ atlama anında özel jingle.
- **Telif notu:** Orijinal oyunun hiçbir grafiğini, sesini veya kodunu kullanmıyoruz; yalnızca tür mekaniklerinden esinleniyoruz. "Age of War" adı da kullanılmayacak. Geçici grafikler için ücretsiz lisanslı paketler (Kenney, CraftPix ücretsizleri, OpenGameArt — lisansları tek tek kontrol ederek).

---

## 5. Teknoloji yığını

| Katman | Seçim | Neden |
|---|---|---|
| Dil | **TypeScript** | Tip güvenliği, büyüyen veri modelinde hata azaltır |
| Motor | **Phaser 3** | Tarayıcıda çalışan olgun 2D oyun motoru; sprite, animasyon, ses, giriş hazır. Orijinal gibi tarayıcıda oynanır |
| Derleme | **Vite** | Hızlı geliştirme sunucusu, anında yenileme |
| Simülasyon | Motordan bağımsız saf TS modülü | Deterministik, test edilebilir, sunucuda/headless çalıştırılabilir |
| Veri | JSON (`data/ages/*.json`) | Denge ayarı kodsuz |
| Test | **Vitest** | Simülasyon ve denge testleri |
| Kayıt | localStorage (sonra bulut) | Basit başlangıç |
| Dağıtım | Web (itch.io / GitHub Pages) → ileride **Tauri** (PC/Steam), **Capacitor** (mobil) | Tek kod tabanı, her platform |

Alternatif: **Godot 4** (masaüstü/mobil için daha güçlü editör, ama web çıktısı daha ağır). Web öncelikliyse Phaser daha doğru.

### Mimari taslak
```
src/
  sim/          # saf oyun mantığı (Phaser'a bağımlı değil)
    world.ts    # durum: birimler, üsler, kuleler, ekonomi
    systems/    # hareket, savaş, ekonomi, çağ, AI
    rng.ts      # tohumlu rastgelelik (determinizm)
  game/         # Phaser sahneleri ve görselleştirme
    scenes/     # Boot, Menu, Battle, UI, Result
    views/      # sim varlıklarını sprite'lara eşleyen katman
  data/         # çağ, birim, kule, güç tanımları (JSON)
  ui/
tests/
```
Kural: `sim/` asla `game/`'i import etmez. Görselleştirme simülasyonu okur, komutları (üret, kule kur, güç kullan, ordu komutu) kuyruk üzerinden gönderir.

---

## 6. Yol haritası

| Faz | Hedef | Çıktı | Tahmini süre* |
|---|---|---|---|
| **0 — İskelet** | Proje kurulumu | Vite + Phaser + TS + Vitest, boş sahne, git | 1 oturum |
| **1 — Oynanabilir prototip** | Çekirdek döngü | Renkli kutularla 2 çağ, 3 birim, savaş, altın/XP, çağ atlama, basit AI, kazan/kaybet | 2–4 oturum |
| **2 — Tam içerik iskeleti** | 7 çağ verisi | Tüm birim/kule/özel güç verileri, kule yuvaları, 4. birim + counter halkası | 3–5 oturum |
| **3 — Derinlik** | Bizi orijinalden ayıran sistemler | Ordu komutları, yükseltmeler, ön hat, alan hasarı, AI kişilikleri, zorluklar, oyun hızı | 3–5 oturum |
| **4 — Görsel ve ses** | Oyun gibi görünmesi | Sprite'lar, animasyonlar, paralaks, efektler, müzik/ses, menüler | süreye göre esnek |
| **5 — İçerik ve modlar** | Tekrar oynanabilirlik | Kampanya, Hayatta Kalma, Günlük Meydan Okuma, kayıt, başarımlar | 4–6 oturum |
| **6 — Opsiyonel** | Genişleme | Çevrimiçi PvP, mobil/PC paketleri, Steam | sonra |

*"Oturum" = benimle bir çalışma seansı; grafik üretimi bu süreye dahil değil.

**Prototipin başarı ölçütü (Faz 1 sonu):** Renkli kutularla bile 5 dakikalık bir maç "bir el daha" dedirtiyor mu? Değilse sanata geçmeden çekirdek düzeltilir.

---

## 7. Başlangıç denge tablosu (prototip, Taş + Antik)

| Birim | Rol | Altın | Can | Hasar | Saldırı aralığı (sn) | Menzil | Hız | Ödül altın / XP |
|---|---|---|---|---|---|---|---|---|
| Sopalı | Piyade | 15 | 55 | 8 | 1.0 | 20 | 40 | 20 / 40 |
| Sapancı | Destek | 25 | 40 | 6 | 1.2 | 140 | 40 | 33 / 60 |
| Mızraklı | Zırh-delici | 40 | 60 | 10 | 1.1 | 35 | 38 | 52 / 80 |
| Mamut binici | Ağır | 100 | 220 | 22 | 1.6 | 25 | 30 | 130 / 160 |

Kurallar: ödül altın ≈ maliyet × 1,3; bir sonraki çağın değerleri ≈ ×3,5; Antik Çağ eşiği 4.000 XP. Bu sayılar yalnızca başlangıç; Faz 1'de headless simülasyonla (AI vs AI binlerce maç) ayarlanacak.

---

## 8. Açık sorular (senin kararın)

1. **Platform:** Önce tarayıcı (önerim) mı, yoksa doğrudan PC/mobil mi?
2. **Görsel stil:** Vektör çizgi film mi, piksel sanatı mı? Grafikleri kim üretecek (sen, hazır paket, yapay zekâ aracı)?
3. **Tema:** Genel dünya tarihi mi, yoksa Türk/Osmanlı tarihi ağırlıklı çağlar mı (ör. Göktürk okçusu, yeniçeri, Osmanlı topçusu)?
4. **Çok oyunculu:** Sadece AI'a karşı mı, ileride çevrimiçi PvP hedefi var mı? (Varsa mimariyi baştan deterministik kuruyoruz — taslak zaten öyle.)
5. **İsim:** "Çağlar Boyu Savaş" kalsın mı, yoksa özgün bir isim mi?
6. **Kapsam:** Hobi projesi mi, yayınlanacak (itch.io / Steam / mağaza) bir ürün mü?

---

## Kaynaklar
- [Age of War User's Manual — Armor Games Community](https://armorgames.com/community/thread/3323778/age-of-war-users-manual-brief) (çağ, XP, birim ve kule maliyetleri)
- [Age of War Wiki — Units](https://aowg.fandom.com/wiki/Units), [Stone Age](https://aowg.fandom.com/wiki/Stone_Age), [Dino Rider](https://aowg.fandom.com/wiki/Dino_Rider)
- [Flash Gaming Wiki — Age of War](https://flashgaming.fandom.com/wiki/Age_of_War)
- [Critical Play: Is this game balanced? – Age of War (Mechanics of Magic)](https://mechanicsofmagic.com/2021/05/25/critical-play-is-this-game-balanced-age-of-war/) (tasarım eleştirisi)
- [MobyGames — Age of War 2](https://www.mobygames.com/game/age-of-war-2?s=platform) (counter halkası, kuleler, yükseltmeler)
- [APKMirror — Age of War 2 sürüm notları](https://apkmirror.com/apk/max-games-studios/age-of-war-2/age-of-war-2-1-4-11-release) (büyüler, generaller modu)
- [Skeleton Code Machine — Are lane battlers actually area control games?](https://www.skeletoncodemachine.com/p/lane-battlers) (tür analizi)
