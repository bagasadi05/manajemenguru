
export type ViolationItem = {
    code: string;
    description: string;
    points: number;
    category: 'Ringan' | 'Sedang' | 'Berat';
};

export const violationList: ViolationItem[] = [
    // Pelanggaran Ringan - 3 Poin
    { code: '01', description: 'Terlambat masuk sekolah', points: 3, category: 'Ringan' },
    { code: '02', description: 'Tanpa bedge lokasi / Atribut sekolah (Topi, dasi, Rompi Dll.)', points: 3, category: 'Ringan' },
    { code: '03', description: 'Tidak bersepatu hitam dan berkaos kaki putih', points: 3, category: 'Ringan' },
    { code: '04', description: 'Tidak berpakaian rapi /dimodelkan', points: 3, category: 'Ringan' },
    { code: '05', description: 'Memakai jaket, sweater atau rompi di sekolah tanpa ada izin', points: 3, category: 'Ringan' },
    { code: '06', description: 'Tidak pakai topi saat upacara', points: 3, category: 'Ringan' },
    { code: '07', description: 'Memakai aksesori (contoh: gelang, topi)', points: 3, category: 'Ringan' },
    { code: '08', description: 'Tanpa tali pinggang hitam', points: 3, category: 'Ringan' },
    { code: '09', description: 'Keluar masuk ruang tanpa izin guru', points: 3, category: 'Ringan' },
    { code: '10', description: 'Terlambat masuk setelah istirahat', points: 3, category: 'Ringan' },
    { code: '11', description: 'Tidak memperhatikan saat KBM', points: 3, category: 'Ringan' },
    { code: '12', description: 'Membuang sampah sembarangan', points: 3, category: 'Ringan' },
    { code: '13', description: 'Berkuku panjang bagi putra-putri', points: 3, category: 'Ringan' },
    { code: '14', description: 'Tidak patuh pada instruksi guru/petugas', points: 3, category: 'Ringan' },
    { code: '15', description: 'Pemalsuan identitas (atribut, kartu, atau tanda pengenal sekolah lain)', points: 3, category: 'Ringan' },
    { code: '16', description: 'Pakaian dicoret-coret', points: 3, category: 'Ringan' },
    { code: '17', description: 'Tidak memakai seragam olahraga pada saat jam pelajaran olahraga', points: 3, category: 'Ringan' },
    { code: '18', description: 'Tidak mengikuti kegiatan pembinaan keagamaan tanpa alasan yang jelas', points: 3, category: 'Ringan' },
    { code: '19', description: 'Memakai make-up dan perhiasan yang berlebihan bagi putri', points: 3, category: 'Ringan' },
    { code: '20', description: 'Makan sambil berdiri', points: 3, category: 'Ringan' },
    { code: '21', description: 'Membeli jajan di luar kantin sekolah', points: 3, category: 'Ringan' },
    { code: '22', description: 'Mencoret-coret area sekolah (meja, tembok, dll.)', points: 3, category: 'Ringan' },
    { code: '23', description: 'Bermain kertas (disobek, mainan pesawat, dll.)', points: 3, category: 'Ringan' },
    { code: '24', description: 'Bermain di jam pelajaran', points: 3, category: 'Ringan' },
    { code: '25', description: 'Berkata kotor', points: 3, category: 'Ringan' },
    { code: '26', description: 'Memakai barang bukan miliknya', points: 3, category: 'Ringan' },
    { code: '27', description: 'Masuk di kelas lain tanpa izin', points: 3, category: 'Ringan' },

    // Pelanggaran Sedang - 7 Poin
    { code: '28', description: 'Tidak mengikuti upacara bendera', points: 7, category: 'Sedang' },
    { code: '29', description: 'Pulang sekolah sebelum pelajaran selesai', points: 7, category: 'Sedang' },
    { code: '30', description: 'Kabur pada jam pelajaran', points: 7, category: 'Sedang' },
    { code: '31', description: 'Bawa HandPhone ke sekolah', points: 7, category: 'Sedang' },
    { code: '32', description: 'Membawa komik, majalah, atau novel', points: 7, category: 'Sedang' },
    { code: '33', description: 'Alpha >3 hari tanpa keterangan', points: 7, category: 'Sedang' },
    { code: '34', description: 'Membuat keterangan palsu', points: 7, category: 'Sedang' },
    { code: '35', description: 'Rambut panjang, Punk (L)', points: 7, category: 'Sedang' },
    { code: '36', description: 'Mencat rambut dan bertato (L/P)', points: 7, category: 'Sedang' },
    { code: '37', description: 'Pelecehan terhadap siswi perempuan', points: 7, category: 'Sedang' },
    { code: '38', description: 'Merusak fasilitas sekolah', points: 7, category: 'Sedang' },
    { code: '39', description: 'Ribut/mengganggu proses belajar', points: 7, category: 'Sedang' },
    { code: '40', description: 'Mengganggu barang/kendaraan guru dan staf', points: 7, category: 'Sedang' },
    { code: '41', description: 'Pemalsuan nilai dan tanda tangan Kepala sekolah, guru dan staf tata usaha', points: 7, category: 'Sedang' },
    { code: '42', description: 'Mengolok-olok teman/mengejek', points: 7, category: 'Sedang' },

    // Pelanggaran Berat
    { code: '43', description: 'Melawan/menghina/mengejek kepala sekolah, guru, dan staf TU', points: 15, category: 'Berat' },
    { code: '44', description: 'Meloncat pagar sekolah', points: 20, category: 'Berat' },
    { code: '45', description: 'Berkelahi/tawuran', points: 20, category: 'Berat' },
    { code: '46', description: 'Membawa senjata tajam', points: 15, category: 'Berat' },
    { code: '47', description: 'Mencuri', points: 20, category: 'Berat' },
    { code: '48', description: 'Membawa buku, kaset, VCD Terlarang', points: 20, category: 'Berat' },
    { code: '49', description: 'Menodong teman', points: 15, category: 'Berat' },
    { code: '50', description: 'Melabrak teman/adik kelas', points: 15, category: 'Berat' },
    { code: '51', description: 'Perjudian', points: 20, category: 'Berat' },
    { code: '52', description: 'Pengeroyokan/pemukulan', points: 20, category: 'Berat' },
    { code: '53', description: 'Adu domba/provokasi', points: 15, category: 'Berat' },
    { code: '54', description: 'Pencemaran nama baik sekolah', points: 20, category: 'Berat' },
    { code: '55', description: 'Merokok / membawa rokok', points: 20, category: 'Berat' },
    { code: '56', description: 'Mengintimidasi /Meneror teman', points: 20, category: 'Berat' },
];