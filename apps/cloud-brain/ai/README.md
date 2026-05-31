# AI Klasörü — İzole Yapı

Her AI kendi klasöründe. Birini değiştirmek diğerini bozmaz.

```
ai/
├── ortak/          PAYLAŞILAN — Gemini/DeepSeek bağlantısı
│   └── provider.py   İki AI da bunu kullanır
├── performans/     PERFORMANS AI — Maarif değerlendirme
│   ├── prompts.py    EDE çerçevesi, 21 eğilim, promptlar
│   ├── rubric.py     deterministik puanlama
│   └── evaluator.py  ana mantık
└── yazili_okuma/   YAZILI OKUMA AI — sınav kağıdı okuma
    ├── prompts.py    puanlama promptları
    ├── grading.py    cevap anahtarı eşleştirme
    └── reader.py     ana mantık
```

## Kural
- `performans/` ve `yazili_okuma/` BİRBİRİNİ import ETMEZ.
- İkisi de SADECE `ortak/provider.py`'yi kullanır.
- Bir AI'ı düzeltmek için o klasörü zip'leyip ver — yeterli.
- Sağlayıcı (Gemini/DeepSeek) değişikliği sadece `ortak/`'ta yapılır.

## İş akışı
"Performans AI'ını düzelt" → `ai/performans/` klasörünü ver.
"Yazılı okuma AI'ını düzelt" → `ai/yazili_okuma/` klasörünü ver.
"Sağlayıcı değiştir" → `ai/ortak/` klasörünü ver.
