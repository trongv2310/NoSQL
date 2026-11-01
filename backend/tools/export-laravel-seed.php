<?php
/**
 * Chạy các seeder gốc của dự án Laravel (php_caulong) trên một "DB giả" nằm trong bộ nhớ
 * rồi xuất toàn bộ bảng ra JSON. Không cần cài Laravel, MySQL hay composer.
 *
 * Cách dùng:  php tools/export-laravel-seed.php <thư-mục-laravel> <file-json-đầu-ra>
 */

namespace Illuminate\Database {
    class Seeder
    {
        public function call(array $classes): void
        {
            foreach ($classes as $c) {
                (new $c)->run();
            }
        }
    }
}

namespace Illuminate\Support\Facades {
    class DB
    {
        public static array $tables = [];

        public const PK = [
            'PhanQuyen' => 'MaQuyen', 'TaiKhoan' => 'MaTaiKhoan', 'LoaiSanPham' => 'MaLoai',
            'NhaCungCap' => 'MaNhaCungCap', 'Hang' => 'MaHang', 'KhuyenMai' => 'MaKhuyenMai',
            'MauSac' => 'MaMau', 'Size' => 'MaSize', 'SanPham' => 'MaSanPham',
            'ChiTietSanPham' => 'MaChiTiet', 'ThongSoVot' => 'MaThongSo', 'KhachHang' => 'MaKhachHang',
            'PhanHoi' => 'MaPhanHoi', 'TranDau' => 'MaTranDau', 'TinTuc' => 'MaTin',
        ];

        public static function table(string $name): \Illuminate\Support\Facades\Tbl
        {
            return new Tbl($name);
        }
    }

    class Hash
    {
        public static function make(string $v): string
        {
            return password_hash($v, PASSWORD_BCRYPT, ['cost' => 10]);
        }
    }

    class Schema
    {
        public static function __callStatic(string $n, array $a): void {}
    }

    class Tbl
    {
        private array $conds = [];

        public function __construct(private string $name)
        {
            DB::$tables[$name] ??= [];
        }

        private function norm(array $row): array
        {
            foreach ($row as $k => $v) {
                if (is_object($v)) {
                    $row[$k] = (string) $v;
                }
            }
            return $row;
        }

        public function truncate(): void
        {
            DB::$tables[$this->name] = [];
        }

        public function insert(array $rows): bool
        {
            if ($rows && !array_is_list($rows)) {
                $rows = [$rows];
            }
            foreach ($rows as $r) {
                $this->add($r);
            }
            return true;
        }

        private function add(array $row): int
        {
            $row = $this->norm($row);
            $pk = DB::PK[$this->name] ?? null;
            if ($pk && !isset($row[$pk])) {
                $max = 0;
                foreach (DB::$tables[$this->name] as $x) {
                    $max = max($max, (int) ($x[$pk] ?? 0));
                }
                $row = [$pk => $max + 1] + $row;
            }
            DB::$tables[$this->name][] = $row;
            return (int) ($row[$pk] ?? count(DB::$tables[$this->name]));
        }

        public function insertGetId(array $row): int
        {
            return $this->add($row);
        }

        public function where($col, $val = null): self
        {
            $c = is_array($col) ? $col : [$col => $val];
            $this->conds = array_merge($this->conds, $c);
            return $this;
        }

        private function matches(): array
        {
            $out = [];
            foreach (DB::$tables[$this->name] as $i => $r) {
                $ok = true;
                foreach ($this->conds as $k => $v) {
                    if (!array_key_exists($k, $r) || (string) $r[$k] !== (string) $v) {
                        $ok = false;
                        break;
                    }
                }
                if ($ok) {
                    $out[$i] = $r;
                }
            }
            return $out;
        }

        public function exists(): bool
        {
            return count($this->matches()) > 0;
        }

        public function first(): ?object
        {
            $m = $this->matches();
            return $m ? (object) reset($m) : null;
        }

        public function value(string $col)
        {
            $m = $this->matches();
            return $m ? (reset($m)[$col] ?? null) : null;
        }

        public function updateOrInsert(array $attrs, array $values = []): bool
        {
            $values = $this->norm($values);
            $this->conds = $attrs;
            $m = $this->matches();
            if ($m) {
                $i = array_key_first($m);
                DB::$tables[$this->name][$i] = $values + DB::$tables[$this->name][$i];
            } else {
                $this->add($attrs + $values);
            }
            return true;
        }
    }
}

namespace {
    class NowShim
    {
        public function __toString(): string { return date('Y-m-d H:i:s'); }
        public function toDateTimeString(): string { return date('Y-m-d H:i:s'); }
    }

    function now(): NowShim { return new NowShim(); }

    [, $thuMuc, $dauRa] = $argv + [null, null, null];
    if (!$thuMuc || !$dauRa) {
        fwrite(STDERR, "Dùng: php export-laravel-seed.php <thư-mục-laravel> <file-json>\n");
        exit(1);
    }
    foreach (['BadmintonSeeder', 'PhuKienSeeder', 'BanTinSeeder', 'BoSungBienTheSeeder'] as $s) {
        require_once rtrim($thuMuc, '/') . "/database/seeders/$s.php";
    }
    foreach (['BadmintonSeeder', 'PhuKienSeeder', 'BanTinSeeder', 'BoSungBienTheSeeder'] as $s) {
        $c = "Database\\Seeders\\$s";
        (new $c)->run();
    }
    file_put_contents(
        $dauRa,
        json_encode(\Illuminate\Support\Facades\DB::$tables, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
    );
    foreach (\Illuminate\Support\Facades\DB::$tables as $t => $rows) {
        fwrite(STDERR, str_pad($t, 18) . count($rows) . "\n");
    }
}
