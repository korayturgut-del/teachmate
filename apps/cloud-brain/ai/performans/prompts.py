"""Millî Eğitim Bakanlığı — Türkiye Yüzyılı Maarif Modeli İşletim Sistemi (Maarif OS)

ai/performans/prompts.py
Sistem Seviyesi Persona Anayasası, Üst Düzey Ontolojik Kategori Ağacı,
Deterministik Karar Parametreleri ve Davranış Veri Üretim Şablon Matrisi.
"""

import json

# ============================================================================
# 0. GERİYE DÖNÜK UYUMLULUK — Eski sabitler korunur
# ============================================================================
CATI_DEGERLER = [
    "adalet", "aile bütünlüğü", "bağımsızlık", "barış", "çalışkanlık",
    "dürüstlük", "estetik", "merhamet", "saygı", "sevgi",
    "sorumluluk", "tasarruf", "vatanseverlik", "yardımseverlik", "sabır",
]

EGILIMLER = {
    "entelektuel": [
        "merak", "araştırma ruhu", "analitik düşünme", "eleştirel düşünme",
        "sistemli düşünme", "açık fikirlilik", "yaratıcılık",
    ],
    "sosyal": [
        "iş birliği", "iletişim", "empati", "liderlik",
        "sorumluluk bilinci", "saygı", "uzlaşma",
    ],
    "benlik": [
        "öz farkındalık", "öz düzenleme", "azim", "sabır",
        "öz güven", "estetik duyarlılık", "merhamet",
    ],
}

BECERILER = [
    "problem çözme", "karar verme", "bilgi okuryazarlığı",
    "dijital okuryazarlık", "öz değerlendirme", "yansıtıcı düşünme",
]

GRADE_TYPE_FOCUS = {
    "sinifIciEtkinlik": {
        "label": "Sınıf İçi Etkinlik", "primary_dimension": "sosyal",
        "hint": "Grup içi rol, katılım, iş birliği ve iletişim becerileri.",
    },
    "ozDegerlendirme": {
        "label": "Öz Değerlendirme", "primary_dimension": "benlik",
        "hint": "Öğrencinin yansıtma derinliği, öz farkındalık ve öz düzenleme.",
    },
    "proje": {
        "label": "Dönem Projesi", "primary_dimension": "entelektuel",
        "hint": "Araştırma derinliği, yaratıcılık, sistemli düşünme, sunum.",
    },
}

# ============================================================================
# 1. SİSTEM PERSONA ANAYASASI
# ============================================================================
MAARIF_SYSTEM_PERSONA = {
    "kimlik": "T.C. Millî Eğitim Bakanlığı Türkiye Yüzyılı Maarif Modeli Kıdemli Başmüfredat Uzmanı ve Bilge Muallim",
    "deneyim_yili": 30,
    "temel_felsefe": (
        "Eğitimin nihai gayesi; insanı sadece bilgi yüklenen bir nesne değil, fıtratını koruyan, "
        "zihnen, kalben ve bedenen bütüncül gelişen bir şahsiyet (kâmil insan) olarak yetiştirmektir. "
        "Sistem üç selim sacayağı üzerine kuruludur: Akl-ı Selim, Kalb-i Selim, Zevk-i Selim. "
        "Erdem-Değer-Eylem (EDE) matrisinde eylemden erdeme iz sürülür."
    ),
    "dil_barajlari": {
        "yasakli_klinik_kelimeler": [
            "yetersiz", "başarısız", "eksik", "zayıf", "kurallara uymuyor",
            "disiplinsiz", "problemli", "negatif", "kusurlu", "beceriksiz",
        ],
        "zorunlu_pedagojik_ifadeler": [
            "keşfedilmeyi bekleyen potansiyel", "gelişime açık alanlar",
            "adım adım ilerleyen başarı serüveni", "emek ve azimle taçlanacak süreç",
            "içsel farkındalık odakları", "kalb-i selim derinliği", "akl-ı selim yaklaşımı",
        ],
    },
}

# ============================================================================
# 2. ÜST DÜZEY ONTOLOJİK KATEGORİ AĞACI
# ============================================================================
MAARIF_ONTOLOGY_TREE = {
    "Sorumluluk": {"ust_boyut": "Akl-ı Selim & Kalb-i Selim", "alt_kategoriler": ["Görev Bilinci", "Zaman Yönetimi", "Öz Disiplin", "Takip Becerisi"]},
    "Saygı": {"ust_boyut": "Kalb-i Selim & Zevk-i Selim", "alt_kategoriler": ["Etkin Dinleme", "Söz Hakkına Riayet", "Farklılıklara Hürmet", "Ortak Alan Sınırları"]},
    "Yardımseverlik": {"ust_boyut": "Kalb-i Selim", "alt_kategoriler": ["Gönüllü Katılım", "Bilgi ve Deneyim Paylaşımı", "Akran Desteği", "Diğerkâmlık"]},
    "Dürüstlük": {"ust_boyut": "Akl-ı Selim & Kalb-i Selim", "alt_kategoriler": ["Akademik Dürüstlük", "Özü-Sözü Birlik", "Hata Üstlenme Olgunluğu", "Güvenilirlik"]},
    "Sabır": {"ust_boyut": "Akl-ı Selim", "alt_kategoriler": ["Bilişsel Metanet", "Dürtü Kontrolü", "Süreç İstikrarı", "Fevrilikten Kaçınma"]},
    "Adalet": {"ust_boyut": "Akl-ı Selim & Kalb-i Selim", "alt_kategoriler": ["Hakkaniyetli Paylaşım", "Tarafsızlık", "Akran Haklarını Savunma", "Objektif Değerlendirme"]},
    "Çalışkanlık": {"ust_boyut": "Akl-ı Selim", "alt_kategoriler": ["Ceht ve Gayret", "İç Motivasyon", "Sürekli Gelişim Arayışı", "Zorlukla Mücadele"]},
    "Tasarruf": {"ust_boyut": "Zevk-i Selim", "alt_kategoriler": ["Kaynak Farkındalığı", "Kamu Malını Koruma", "Zamanı Efektif Kullanma", "Ekolojik Hassasiyet"]},
    "Merhamet": {"ust_boyut": "Kalb-i Selim", "alt_kategoriler": ["Şefkat ve Akran Kapsayıcılığı", "Duygusal Paydaşlık", "Canlılara Hürmet", "Zarar Vermekten Kaçınma"]},
    "Sevgi": {"ust_boyut": "Kalb-i Selim", "alt_kategoriler": ["Bağlılık", "Kucaklayıcılık", "Vefa", "Karşılıksız İlgi"]},
    "Barış": {"ust_boyut": "Kalb-i Selim & Zevk-i Selim", "alt_kategoriler": ["Uzlaşı", "Şiddetsizlik", "Arabuluculuk", "Hoşgörü"]},
    "Vatanseverlik": {"ust_boyut": "Akl-ı Selim & Kalb-i Selim", "alt_kategoriler": ["Aidiyet", "Ortak Değerlere Saygı", "Toplumsal Katkı", "Tarih Bilinci"]},
    "Aile Bütünlüğü": {"ust_boyut": "Kalb-i Selim", "alt_kategoriler": ["Aile Bağı", "Büyüklere Saygı", "Paylaşım", "Sorumluluk Üstlenme"]},
    "Estetik": {"ust_boyut": "Zevk-i Selim", "alt_kategoriler": ["Görsel Duyarlılık", "Düzen ve İncelik", "Yaratıcı İfade", "Sanata Saygı"]},
    "Bağımsızlık": {"ust_boyut": "Akl-ı Selim", "alt_kategoriler": ["Öz Yeterlik", "Kendi Kararını Verme", "Özgün Üretim", "İnisiyatif Alma"]},
}

# ============================================================================
# 3. DAVRANIŞ TOHUM KÜTÜPHANESİ ('gosterge' alanı eklendi)
# ============================================================================
BEHAVIOR_SEED_DATABASE = [
    {"id": "M.SORU.GB.001", "kademe": "İlkokul", "davranis": "Sınıf içi serbest etkinlik sonrasında kullandığı boya kalemlerini kutusuna koyarak sırasını düzenli bıraktı.", "deger": "Sorumluluk", "alt_kategori": "Görev Bilinci", "gosterge": "Bireysel çalışma alanını kendiliğinden düzenler", "egilim": "öz düzenleme", "beceri": "öz değerlendirme", "guven_puani": 100, "pozitif_negatif": "Pozitif", "evidence_patterns": ["sırasını düzenli bıraktı", "kalemlerini kutusuna koydu", "arkasını topladı"], "aciklama": "Bireysel eylemlerinin fiziksel çevre üzerindeki sorumluluğunu erken yaşta içselleştirmiştir."},
    {"id": "M.SORU.GB.002", "kademe": "Ortaokul", "davranis": "Grup projesinde üstlendiği sunum hazırlığı görevini hiçbir hatırlatmaya gerek kalmadan gününden önce tamamladı.", "deger": "Sorumluluk", "alt_kategori": "Takip Becerisi", "gosterge": "Üstlendiği görevi hatırlatma gerekmeden tamamlar", "egilim": "sorumluluk bilinci", "beceri": "karar verme", "guven_puani": 98, "pozitif_negatif": "Pozitif", "evidence_patterns": ["hatırlatmaya gerek kalmadan", "gününden önce tamamladı", "görevini yerine getirdi"], "aciklama": "Akran odaklı süreçlerde toplumsal sözleşmeye sadık kalma olgunluğu."},
    {"id": "M.SORU.GB.003", "kademe": "Lise", "davranis": "TÜBİTAK proje başvurusunda takım kaptanı olarak formların eksiksiz doldurulmasını koordine etti.", "deger": "Sorumluluk", "alt_kategori": "Görev Bilinci", "gosterge": "Ekip sürecini uçtan uca koordine eder", "egilim": "liderlik", "beceri": "dijital okuryazarlık", "guven_puani": 95, "pozitif_negatif": "Pozitif", "evidence_patterns": ["koordine etti", "eksiksiz doldurulmasını sağladı", "sisteme yükledi"], "aciklama": "Yüksek düzeyli süreçlerde sorumluluk üstlenme ve liderlik becerisi."},
    {"id": "M.SORU.GB.004", "kademe": "Ortaokul", "davranis": "Laboratuvar çalışmasında deney setini temiz bırakması gerektiği hatırlatılmasına rağmen masadan doğrudan ayrıldı.", "deger": "Sorumluluk", "alt_kategori": "Öz Disiplin", "gosterge": "Ortak alan temizliğinde gelişim ihtiyacı gösterir", "egilim": "sorumluluk bilinci", "beceri": "yansıtıcı düşünme", "guven_puani": 92, "pozitif_negatif": "Negatif", "evidence_patterns": ["temizlemeden ayrıldı", "masadan doğrudan ayrıldı", "dağınık bıraktı"], "aciklama": "Ortak kullanım alanlarındaki eylem sonuçlarını üstlenmede gelişime açık alan."},
    {"id": "M.SORU.GB.005", "kademe": "Lise", "davranis": "Dönem ödevi yönergesini arkadaşlarıyla inceledi ancak kendi bölümüyle ilgili henüz eyleme geçmedi.", "deger": "Sorumluluk", "alt_kategori": "Takip Becerisi", "gosterge": "Süreci izler ancak eyleme geçişte destek ister", "egilim": "sistemli düşünme", "beceri": "bilgi okuryazarlığı", "guven_puani": 88, "pozitif_negatif": "Nötr", "evidence_patterns": ["yönergeyi inceledi", "eyleme geçmedi", "beklemede kaldı"], "aciklama": "Süreci bilişsel takip etmekle birlikte eylemsel boyutta motivasyon desteğine ihtiyaç duyar."},
    {"id": "M.SAYG.ED.001", "kademe": "İlkokul", "davranis": "Arkadaşı fikrini söylerken araya girmeden parmağını kaldırarak sırasını bekledi.", "deger": "Saygı", "alt_kategori": "Söz Hakkına Riayet", "gosterge": "Konuşan akranını bölmeden sırasını bekler", "egilim": "sabır", "beceri": "öz değerlendirme", "guven_puani": 100, "pozitif_negatif": "Pozitif", "evidence_patterns": ["araya girmeden", "parmağını kaldırarak", "sırasını bekledi", "sözünü kesmedi"], "aciklama": "Akranının ifade özgürlüğüne ve iletişim sınırlarına saygı eylemi."},
    {"id": "M.SAYG.ED.002", "kademe": "Ortaokul", "davranis": "Münazarada karşı takımın zıt tezini sonuna kadar not alarak dinledi.", "deger": "Saygı", "alt_kategori": "Farklılıklara Hürmet", "gosterge": "Zıt görüşleri sonuna kadar dinleyip not alır", "egilim": "açık fikirlilik", "beceri": "eleştirel düşünme", "guven_puani": 97, "pozitif_negatif": "Pozitif", "evidence_patterns": ["not alarak dinledi", "sonuna kadar dinledi", "görüşe saygı gösterdi"], "aciklama": "Farklı entelektüel duruşlara karşı zevk-i selim iletişim zarafeti."},
    {"id": "M.SAYG.ED.003", "kademe": "Lise", "davranis": "Panelde panelistin konuşması esnasında yüksek sesle fısıldaşarak odak dağıttı.", "deger": "Saygı", "alt_kategori": "Ortak Alan Sınırları", "gosterge": "Topluluk önünde dinleme nezaketinde gelişim gösterir", "egilim": "iletişim", "beceri": "öz değerlendirme", "guven_puani": 94, "pozitif_negatif": "Negatif", "evidence_patterns": ["yüksek sesle fısıldaştı", "odak dağıttı", "konuşmayı böldü"], "aciklama": "Konuşan bireyin emeğine ve sınıfın dinleme hakkına yönelik farkındalık alanı."},
    {"id": "M.YARD.AD.001", "kademe": "İlkokul", "davranis": "Kesme işleminde zorlanan sıra arkadaşına makası güvenli şekilde uzatarak yardım etti.", "deger": "Yardımseverlik", "alt_kategori": "Akran Desteği", "gosterge": "Zorlanan akranına kendiliğinden destek olur", "egilim": "empati", "beceri": "problem çözme", "guven_puani": 99, "pozitif_negatif": "Pozitif", "evidence_patterns": ["yardım etti", "destek oldu", "makası uzattı", "gönüllü yardım"], "aciklama": "Akranının zorluğunu fark edip kalb-i selim hassasiyetiyle karşılıksız destek."},
    {"id": "M.YARD.AD.002", "kademe": "Ortaokul", "davranis": "Yazılı öncesi ortak sürücüye kendi çıkardığı özetleri ve kavram haritalarını yükledi.", "deger": "Yardımseverlik", "alt_kategori": "Bilgi ve Deneyim Paylaşımı", "gosterge": "Kendi ürettiği kaynağı sınıfla paylaşır", "egilim": "iş birliği", "beceri": "dijital okuryazarlık", "guven_puani": 96, "pozitif_negatif": "Pozitif", "evidence_patterns": ["özetlerini yükledi", "kavram haritalarını paylaştı", "ortak sürücüye"], "aciklama": "Bilgiyi kolektif zekanın gelişimine sunarak entelektüel yardımseverlik."},
    {"id": "M.DURU.AD.001", "kademe": "Lise", "davranis": "Coğrafya ödevinde istatistik verilerin kaynağını dipnot ve kaynakçada belirtti.", "deger": "Dürüstlük", "alt_kategori": "Akademik Dürüstlük", "gosterge": "Kullandığı kaynakları eksiksiz künyelendirir", "egilim": "araştırma ruhu", "beceri": "bilgi okuryazarlığı", "guven_puani": 100, "pozitif_negatif": "Pozitif", "evidence_patterns": ["kaynakçada belirtti", "dipnot verdi", "kaynağını gösterdi"], "aciklama": "Emeğe hürmet ve akl-ı selim süzgecinden geçmiş akademik dürüstlük."},
    {"id": "M.DURU.AD.002", "kademe": "Ortaokul", "davranis": "İnternetten kopyaladığı metni kendi özgün fikri gibi sunmaya çalıştı.", "deger": "Dürüstlük", "alt_kategori": "Özü-Sözü Birlik", "gosterge": "Kaynak sahiplenmede içsel farkındalık geliştirir", "egilim": "analitik düşünme", "beceri": "dijital okuryazarlık", "guven_puani": 95, "pozitif_negatif": "Negatif", "evidence_patterns": ["internetten kopyaladı", "aynen aldı", "intihal yaptı"], "aciklama": "Kendi üretimi olmayan veriyi sahiplenme; içsel farkındalık odağı."},
    {"id": "M.SABR.BM.001", "kademe": "Lise", "davranis": "Syntax hatasını pes etmeden 4 farklı debug yöntemi deneyerek çözdü.", "deger": "Sabır", "alt_kategori": "Bilişsel Metanet", "gosterge": "Zorluk karşısında ısrarla farklı yol dener", "egilim": "azim", "beceri": "problem çözme", "guven_puani": 98, "pozitif_negatif": "Pozitif", "evidence_patterns": ["pes etmeden", "vazgeçmedi", "deneyerek çözdü", "havlu atmadı"], "aciklama": "Bilişsel bariyerler karşısında iç disiplinini koruma yetisi."},
    {"id": "M.ADAL.HP.001", "kademe": "Ortaokul", "davranis": "Takımların dengesiz olduğunu fark edip kendi takımından güçlü oyuncunun karşıya geçmesini önerdi.", "deger": "Adalet", "alt_kategori": "Hakkaniyetli Paylaşım", "gosterge": "Kazanmaktan önce hakkaniyeti gözetir", "egilim": "uzlaşma", "beceri": "karar verme", "guven_puani": 97, "pozitif_negatif": "Pozitif", "evidence_patterns": ["karşıya geçmesini önerdi", "dengesiz olduğunu fark edip", "adil oyun"], "aciklama": "Kazanma arzusunun önüne hakkaniyet koyabilen kalb-i selim olgunluğu."},
    {"id": "M.CALI.CG.001", "kademe": "İlkokul", "davranis": "Harfleri hizalamakta zorlanmasına rağmen tüm sayfayı özenle silip tekrar yazarak tamamladı.", "deger": "Çalışkanlık", "alt_kategori": "Ceht ve Gayret", "gosterge": "Motor zorlukta vazgeçmeden tekrar dener", "egilim": "azim", "beceri": "öz değerlendirme", "guven_puani": 96, "pozitif_negatif": "Pozitif", "evidence_patterns": ["silip tekrar yazarak", "özenle tamamladı", "çabaladı"], "aciklama": "Motor beceri zorluklarında ceht ve gayretle tamamlama istikrarı."},
    {"id": "M.TASA.KM.001", "kademe": "Ortaokul", "davranis": "Sınıfta kimsenin kalmadığını görüp açık akıllı tahtayı ve lambaları kapattı.", "deger": "Tasarruf", "alt_kategori": "Kamu Malını Koruma", "gosterge": "İsrafı önlemek için kendiliğinden harekete geçer", "egilim": "sorumluluk bilinci", "beceri": "finansal okuryazarlık", "guven_puani": 100, "pozitif_negatif": "Pozitif", "evidence_patterns": ["lambaları kapattı", "tahtayı kapattı", "israfı önledi"], "aciklama": "Kamu kaynaklarının korunmasına yönelik zevk-i selim farkındalığı."},
    {"id": "M.MERH.SA.001", "kademe": "İlkokul", "davranis": "Yeni nakil gelen ve tek başına oturan arkadaşını fark edip kendi grubuna davet etti.", "deger": "Merhamet", "alt_kategori": "Şefkat ve Akran Kapsayıcılığı", "gosterge": "Dışlanma riskindeki akranını gruba dâhil eder", "egilim": "empati", "beceri": "karar verme", "guven_puani": 99, "pozitif_negatif": "Pozitif", "evidence_patterns": ["grubuna davet etti", "fark edip", "yalnız bırakmadı", "kapsayıcı"], "aciklama": "Akran dışlanmasını engelleyen fıtri şefkat ve kalb-i selim derinliği."},
    {"id": "M.MERH.CH.001", "kademe": "İlkokul", "davranis": "Bahçedeki yaralı bir kuşu fark edip incitmeden gölgeye taşıdı ve öğretmenine haber verdi.", "deger": "Merhamet", "alt_kategori": "Canlılara Hürmet", "gosterge": "Canlının zarar görmesini önlemek için harekete geçer", "egilim": "merhamet", "beceri": "karar verme", "guven_puani": 97, "pozitif_negatif": "Pozitif", "evidence_patterns": ["yaralı kuşu", "incitmeden taşıdı", "canlıya zarar vermeden"], "aciklama": "Canlılara hürmet ve zarar vermekten kaçınma temelli kalb-i selim duyarlılığı."},
    {"id": "M.SEVG.VF.001", "kademe": "Ortaokul", "davranis": "Hasta olduğu için okula gelemeyen arkadaşının ödevlerini toplayıp evine götürmeyi teklif etti.", "deger": "Sevgi", "alt_kategori": "Vefa", "gosterge": "Akranına karşılıksız vefa gösterir", "egilim": "empati", "beceri": "karar verme", "guven_puani": 96, "pozitif_negatif": "Pozitif", "evidence_patterns": ["ödevlerini toplayıp", "evine götürmeyi teklif", "arkadaşını sordu"], "aciklama": "Karşılıksız ilgi ve vefa temelli kalb-i selim bağı."},
    {"id": "M.BARI.AR.001", "kademe": "Ortaokul", "davranis": "Tartışan iki arkadaşının arasına girip her ikisini de sakince dinleyerek uzlaştırmaya çalıştı.", "deger": "Barış", "alt_kategori": "Arabuluculuk", "gosterge": "Akranları arasında uzlaşı kurmaya çalışır", "egilim": "uzlaşma", "beceri": "problem çözme", "guven_puani": 95, "pozitif_negatif": "Pozitif", "evidence_patterns": ["arasına girip", "uzlaştırmaya çalıştı", "sakince dinleyerek", "barıştırdı"], "aciklama": "Şiddetsiz çözüm ve arabuluculukla zevk-i selim iletişim olgunluğu."},
    {"id": "M.VATA.TK.001", "kademe": "Lise", "davranis": "Okul çevresindeki tarihi çeşmenin temizlik ve tanıtım projesinde gönüllü olarak görev aldı.", "deger": "Vatanseverlik", "alt_kategori": "Toplumsal Katkı", "gosterge": "Ortak mirasın korunmasına gönüllü katkı sunar", "egilim": "sorumluluk bilinci", "beceri": "bilgi okuryazarlığı", "guven_puani": 94, "pozitif_negatif": "Pozitif", "evidence_patterns": ["gönüllü görev aldı", "tarihi çeşmenin", "tanıtım projesinde"], "aciklama": "Aidiyet ve toplumsal katkı bilinciyle akl-ı selim sorumluluk."},
    {"id": "M.AILE.BS.001", "kademe": "İlkokul", "davranis": "Aile albümü etkinliğinde büyükannesinin anlattığı bir anıyı saygıyla ve heyecanla sınıfla paylaştı.", "deger": "Aile Bütünlüğü", "alt_kategori": "Büyüklere Saygı", "gosterge": "Aile büyüklerine saygı ve bağını dile getirir", "egilim": "öz farkındalık", "beceri": "öz değerlendirme", "guven_puani": 93, "pozitif_negatif": "Pozitif", "evidence_patterns": ["büyükannesinin anısını", "saygıyla paylaştı", "aile albümü"], "aciklama": "Aile bağı ve büyüklere saygı temelli kalb-i selim aidiyeti."},
    {"id": "M.ESTE.YI.001", "kademe": "Ortaokul", "davranis": "Sınıf panosunu düzenlerken renk ve hizalama uyumuna özen göstererek estetik bir bütünlük oluşturdu.", "deger": "Estetik", "alt_kategori": "Düzen ve İncelik", "gosterge": "Görsel düzende incelik ve uyum gözetir", "egilim": "estetik duyarlılık", "beceri": "yansıtıcı düşünme", "guven_puani": 92, "pozitif_negatif": "Pozitif", "evidence_patterns": ["renk uyumuna özen", "estetik bütünlük", "hizalama uyumu", "özenle düzenledi"], "aciklama": "Görsel duyarlılık ve incelikle zevk-i selim ifadesi."},
    {"id": "M.BAGI.IN.001", "kademe": "Lise", "davranis": "Grup dağıldığında projeyi yarıda bırakmak yerine kalan bölümü kendi planını kurarak tek başına tamamladı.", "deger": "Bağımsızlık", "alt_kategori": "İnisiyatif Alma", "gosterge": "Destek olmadan kendi planıyla üretir", "egilim": "öz düzenleme", "beceri": "karar verme", "guven_puani": 95, "pozitif_negatif": "Pozitif", "evidence_patterns": ["kendi planını kurarak", "tek başına tamamladı", "inisiyatif aldı", "yarıda bırakmak yerine"], "aciklama": "Öz yeterlik ve inisiyatifle akl-ı selim bağımsızlık."},
    {"id": "M.DURU.HU.001", "kademe": "İlkokul", "davranis": "Yere düşürdüğü ve kimsenin görmediği bir hatayı kendiliğinden öğretmenine söyleyerek düzeltti.", "deger": "Dürüstlük", "alt_kategori": "Hata Üstlenme Olgunluğu", "gosterge": "Görülmese de hatasını kendiliğinden üstlenir", "egilim": "öz farkındalık", "beceri": "öz değerlendirme", "guven_puani": 98, "pozitif_negatif": "Pozitif", "evidence_patterns": ["kendiliğinden söyledi", "hatasını üstlendi", "kimse görmeden itiraf"], "aciklama": "Özü-sözü birlik ve hata üstlenme olgunluğuyla akl-ı selim dürüstlük."},
    {"id": "M.SABR.DK.001", "kademe": "İlkokul", "davranis": "Sırasını beklerken arkadaşları acele ettirmesine rağmen telaşlanmadan sakince bekledi.", "deger": "Sabır", "alt_kategori": "Dürtü Kontrolü", "gosterge": "Acele ettirilse de dürtüsünü kontrol eder", "egilim": "sabır", "beceri": "öz değerlendirme", "guven_puani": 94, "pozitif_negatif": "Pozitif", "evidence_patterns": ["telaşlanmadan bekledi", "sakince bekledi", "acele etmeden"], "aciklama": "Dürtü kontrolü ve fevrilikten kaçınmayla akl-ı selim metanet."},
    {"id": "M.ADAL.TR.001", "kademe": "Lise", "davranis": "Grup içi puanlamada en sevdiği arkadaşına değil, en çok emek vereni objektif biçimde öne çıkardı.", "deger": "Adalet", "alt_kategori": "Tarafsızlık", "gosterge": "Yakınlık gözetmeden objektif değerlendirir", "egilim": "analitik düşünme", "beceri": "karar verme", "guven_puani": 96, "pozitif_negatif": "Pozitif", "evidence_patterns": ["objektif biçimde", "en çok emek vereni", "tarafsız değerlendirdi"], "aciklama": "Tarafsızlık ve objektif değerlendirmeyle akl-ı selim adalet."},
    {"id": "M.CALI.IM.001", "kademe": "Ortaokul", "davranis": "Anlamadığı konuyu kendi isteğiyle teneffüste tekrar çalışıp ek kaynak araştırdı.", "deger": "Çalışkanlık", "alt_kategori": "İç Motivasyon", "gosterge": "Dışarıdan baskı olmadan kendini geliştirir", "egilim": "araştırma ruhu", "beceri": "bilgi okuryazarlığı", "guven_puani": 95, "pozitif_negatif": "Pozitif", "evidence_patterns": ["kendi isteğiyle çalıştı", "ek kaynak araştırdı", "teneffüste tekrar"], "aciklama": "İç motivasyon ve sürekli gelişim arayışıyla akl-ı selim çalışkanlık."},
]

# ============================================================================
# 4. MASTER SİSTEM PROMPTU ÜRETİCİSİ
# ============================================================================
def build_maarif_system_prompt(focus: dict) -> str:
    return (
        "### SYSTEM IDENTITY & PERSONA CONSTITUTION ###\n"
        f"{json.dumps(MAARIF_SYSTEM_PERSONA, ensure_ascii=False, indent=2)}\n\n"
        "### THEORETICAL ONTOLOGY MATRIX ###\n"
        f"{json.dumps(MAARIF_ONTOLOGY_TREE, ensure_ascii=False, indent=2)}\n\n"
        "### EXECUTION RULE BOUNDARIES ###\n"
        "1. Sen asla karar verici değilsin. Puanlar ve göstergeler alttaki veri motorundan mutlak gerçeklik olarak gelir; değiştirmek YASAKTIR.\n"
        "2. Görevin matematiksel skoru ve ontolojik bağları üç selim derinliğiyle açıklayan pedagojik rapor üretmektir.\n"
        "3. Dil guardrail'larına harfiyen uyacaksın; yasaklı klinik kelime geçerse validator seni reddeder.\n"
        "4. feedback_for_student alanında öğrenciye bilge bir muallim gibi sevgiyle sesleneceksin.\n\n"
        "### CURRENT EVALUATION MODULE ###\n"
        f"- Modül: {focus['label']}\n- Odak: {focus['hint']}\n- Eğilim Boyutu: {focus['primary_dimension']}\n\n"
        "### OUTPUT SCHEMA (STRICT JSON ONLY) ###\n"
        "{\n"
        '  "score_100": <Gelen puanı aynen yaz>,\n'
        '  "maarif_muallimi_yorumu": "<kurumsal analiz>",\n'
        '  "guclu_yonler": "<somut takdirler>",\n'
        '  "gelisim_alanlari": "<yapıcı ufuk tavsiyeleri>",\n'
        '  "yansitici_sorular": "<2 derin soru>",\n'
        '  "feedback_for_student": "<sıcak muallim hitabı>"\n'
        "}"
    )


def build_maarif_user_prompt(student_name: str, focus: dict, observation: str) -> str:
    return (
        "### INPUT DATA FOR GENERATION LAYER ###\n"
        f"Öğrenci Adı: {student_name}\n"
        f"Değerlendirme Modülü: {focus['label']}\n"
        f"Ham Metin Gözlemi: \"{observation or '(Gözlem girilmedi)'}\"\n\n"
        "Talimat: Motorun ürettiği skor ve kodları sistem anayasasına göre pürüzsüz JSON çıktısına dönüştür."
    )
