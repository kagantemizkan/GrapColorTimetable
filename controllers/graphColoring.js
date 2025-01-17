import { db } from "../db.js";

export const komsulukCikar = (req, res) => {
    // Öğrenci komşulukları
    console.log("başladı")
    const deleteQuery = "Delete from dersprogrami"
    db.query(deleteQuery, (err, data) => {
        if (err) {
            return res.json(err);
        }
        console.log("silindi")
    })
    const ogrenciQuery = `
        SELECT ogrenci_id, GROUP_CONCAT(ders_id) AS komsuluk
        FROM ogrenciders
        GROUP BY ogrenci_id;`;
    // Hoca komşulukları
    const hocaQuery = `
        SELECT hoca_id, GROUP_CONCAT(ders_id) AS komsuluk
        FROM ders
        GROUP BY hoca_id;`;

    const q = `SELECT COUNT(DISTINCT ders_id) AS sayi
    FROM ders;`

    const q2 = `SELECT COUNT(DISTINCT sinif_kodu) AS sayi
    FROM sinif;`

    // Her iki sorguyu da paralel olarak çalıştır
    db.query(q, (err, data) => {
        if (err) {
            return res.json(err);
        }

        const maxSayi = data[0].sayi
        db.query(ogrenciQuery, (ogrenciErr, ogrenciData) => {
            db.query(hocaQuery, (hocaErr, hocaData) => {
                if (ogrenciErr || hocaErr) {
                    return res.json(ogrenciErr || hocaErr);
                }

                // Veriyi birleştir
                const birlesikVeri = {
                    ogrenci: ogrenciData,
                    hoca: hocaData,
                };
                const q = `Select sinif_kodu from sinif `
                db.query(q, (err, results) => {
                    if (err) {
                        return err
                    }
                    db.query(q2, (err, data) => {
                        if (err) {
                            return res.json(err);
                        }
                        const siniflar = results.map((row) => row.sinif_kodu);
                        console.log(siniflar)
                        const sinifSayi = data[0].sayi
                        const sonuc = kaydedilenSayilariBul(birlesikVeri, maxSayi);
                        const coloredNodes = welshPowell(sonuc, sinifSayi);
                        console.log(coloredNodes)


                        
                        const insertQuery = 'INSERT INTO dersProgrami (ders_id, color,sinif_kodu) VALUES ?';
                        
                        let value=assignClassCodeAndColor(siniflar,coloredNodes)
                        console.log(value)

                        const values = Object.entries(value).map(([dersId, { color, sinif_kodu }]) => [parseInt(dersId), color, sinif_kodu]);


                        db.query(insertQuery, [values], (err, sonuc) => {
                            if (err) {
                                console.error('Veri eklenirken hata oluştu:', err);
                                throw err;
                            }
                            console.log('Veri başarıyla eklendi');
                            return res.json("başarı")
                            // Veritabanı bağlantısını kapat
                            resolveConflicts()
                        });
                    })



                })

                // Komsulukları hesapla

            });
        });
    })
    
};

function kaydedilenSayilariBul(veri, maxSayi) {
    const kaydedilenSayilar = {};

    for (let i = 1; i <= maxSayi; i++) {
        kaydedilenSayilar[i] = [];

        for (const kategori in veri) {
            for (const eleman of veri[kategori]) {
                const komsuluk = eleman.komsuluk.split(',').map(Number);

                if (komsuluk.includes(i)) {
                    const digerSayilar = komsuluk.filter((sayi) => sayi !== i);
                    kaydedilenSayilar[i] = kaydedilenSayilar[i].concat(digerSayilar);
                }
            }
        }

        // Duplicateleri temizle
        kaydedilenSayilar[i] = [...new Set(kaydedilenSayilar[i])];
    }

    return kaydedilenSayilar;
}

function welshPowell(graph, maxSameColorNeighbors) {
    const sortedNodes = Object.keys(graph).sort((a, b) => graph[b].length - graph[a].length);
    const colors = {};

    for (const node of sortedNodes) {
        const neighborColors = new Set(graph[node].map(neighbor => colors[neighbor]));

        let color = 1;
        while (neighborColors.has(color) || countSameColorNeighbors(graph[node], colors, color) >= maxSameColorNeighbors) {
            color++;
        }

        colors[node] = color;
    }

    return colors;
}

// Düğümün belirli bir renkteki komşu sayısını sayan yardımcı fonksiyon
function countSameColorNeighbors(neighbors, colors, color) {
    return neighbors.reduce((count, neighbor) => {
        return colors[neighbor] === color ? count + 1 : count;
    }, 0);
}

function assignClassCodeAndColor(classes, distribution) {
    let result = {};

    Object.keys(distribution).forEach((key) => {
        let randomClassIndex;

        do {
            randomClassIndex = Math.floor(Math.random() * classes.length);
        } while (result[key]);

        result[key] = {
            color: distribution[key],
            sinif_kodu: classes[randomClassIndex]

        };
    });

    return result;
}   

export const getProgram = (req, res) => {
    const query = `SELECT dp.sinif_kodu,d.ders_adi,d.ders_kodu,d.sinif_sene,p.gun,p.baslangic,h.hoca_ad,h.hoca_soyad,h.hoca_unvan, d.renk
    FROM dersprogrami as dp
    join ders as d
    on d.ders_id=dp.ders_id
    join program as p
    on p.color=dp.color
    join hocalar as h
    on h.id=d.hoca_id
    `
    db.query(query, (err, data) => {
        if (err) {
            return res.json(err)
        }
        return res.json(data)
    })
}
export const studentProgram = (req, res) => {
    const studentId = req.params.id; // Öğrenci ID'sini al

    // Öğrencinin zaten bu dersi aldığını kontrol et
    const q = `SELECT dp.sinif_kodu,d.ders_adi,d.ders_kodu,d.sinif_sene,p.gun,p.baslangic,h.hoca_ad,h.hoca_soyad,h.hoca_unvan,d.renk
    FROM dersprogrami as dp
    join ders as d
    on d.ders_id=dp.ders_id
    join program as p
    on p.color=dp.color
    join hocalar as h
    on h.id=d.hoca_id
    join ogrenciders as od
    on od.ders_id=d.ders_id
    join ogrenciler as o
    on o.ogrenci_id=od.ogrenci_id
    where o.ogrenci_id= ?`;

    db.query(q, [studentId], (err, data) => {
        if (err) return res.json(err);
        return res.status(200).json(data);

    });
};


function resolveConflicts() {
    let conflictsExist = true;

    while (conflictsExist) {
        const conflictQuery = `
        SELECT
        *
    FROM
        dersProgrami
    WHERE
        (color, sinif_kodu) IN (
            SELECT
                color,
                sinif_kodu
            FROM
                dersProgrami
            GROUP BY
                color, sinif_kodu
            HAVING
                COUNT(*) > 1
        );
        `;

        const countClassesQuery = `
            SELECT COUNT(DISTINCT sinif_kodu) AS sayi
            FROM sinif;
        `;

        db.query(conflictQuery, (err, results) => {
            if (err) {
                console.error(err);
                return;
            }

            if (results.length > 0) {
                const conflictList = results.map(row => ({ color: row.color, sinif_kodu: row.sinif_kodu }));

                db.query(countClassesQuery, (err, data) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    const totalClasses = data[0].sayi;

                    // Çakışan sınıfları çöz
                    resolveConflictsInClasses(conflictList, totalClasses);
                });
            } else {
                conflictsExist = false;
            }
        });
    }
}

function resolveConflictsInClasses(conflictList, totalClasses) {
    conflictList.forEach(conflict => {
        const { color, sinif_kodu } = conflict;

        // Rastgele bir başka sınıf seç
        let randomClass;

        do {
            randomClass = Math.floor(Math.random() * totalClasses) + 1;
        } while (randomClass === excludedClass);

        // Çakışan sınıfı yeni sınıf ile değiştir
        const updateQuery = `
            UPDATE dersProgrami
            SET sinif_kodu = '${newClass}'
            WHERE color = '${color}' AND sinif_kodu = '${sinif_kodu}';
        `;

        db.query(updateQuery, (err, results) => {
            if (err) {
                console.error(err);
                return;
            }

            console.log(`Conflict resolved: ${sinif_kodu} in ${color} color replaced with ${newClass}.`);
        });
    });
}

function getRandomClass(totalClasses, excludedClass) {
    let randomClass;

    do {
        randomClass = Math.floor(Math.random() * totalClasses) + 1;
    } while (randomClass === excludedClass);

    return randomClass;
}


