<?php

namespace App\Support;

/**
 * Offline VIN decoder. Standard part: manufacturer (WMI, chars 1–3). Maker-specific
 * part: model year (char 10, only for makers that encode it) and the model /
 * generation, which lives in the VDS (chars 4–9) in each maker's own scheme.
 * Covered: VW group (chars 7–8), Mercedes (series 4–6), Renault, Dacia, Peugeot,
 * Citroën, Opel, Fiat, Alfa Romeo, Volvo, Porsche, Land Rover, Jaguar, Tesla, Jeep.
 * Everything else gets make (+ year where encoded); the model is a hint, never gospel.
 */
final class VinDecoder
{
    /** WMI prefix → make name in the catalogue. */
    private const WMI = [
        'TMB' => 'Škoda', 'TMP' => 'Škoda',
        'WVW' => 'Volkswagen', 'WVG' => 'Volkswagen', 'WV1' => 'Volkswagen', 'WV2' => 'Volkswagen', 'WV3' => 'Volkswagen', 'XW8' => 'Volkswagen',
        'WAU' => 'Audi', 'WA1' => 'Audi', 'WUA' => 'Audi',
        'WBA' => 'BMW', 'WBS' => 'BMW', 'WBY' => 'BMW', 'WBX' => 'BMW',
        'WDB' => 'Mercedes-Benz', 'WDC' => 'Mercedes-Benz', 'WDD' => 'Mercedes-Benz', 'WDF' => 'Mercedes-Benz', 'W1K' => 'Mercedes-Benz', 'W1N' => 'Mercedes-Benz', 'W1V' => 'Mercedes-Benz',
        'W0L' => 'Opel', 'W0V' => 'Opel', 'VXK' => 'Opel',
        'WF0' => 'Ford', 'WF1' => 'Ford',
        'VF1' => 'Renault', 'VF3' => 'Peugeot', 'VR3' => 'Peugeot', 'VF7' => 'Citroën', 'VR7' => 'Citroën',
        'UU1' => 'Dacia',
        'SB1' => 'Toyota', 'JTD' => 'Toyota', 'JTE' => 'Toyota', 'JTM' => 'Toyota', 'JTN' => 'Toyota', 'NMT' => 'Toyota', 'VNK' => 'Toyota',
        'KMH' => 'Hyundai', 'TMA' => 'Hyundai', 'NLH' => 'Hyundai',
        'KNA' => 'Kia', 'KNE' => 'Kia', 'U5Y' => 'Kia', 'U6Y' => 'Kia',
        'VSS' => 'Seat',
        'ZFA' => 'Fiat', 'ZFC' => 'Fiat',
        'SHH' => 'Honda', 'JHM' => 'Honda', 'NLA' => 'Honda',
        'JMZ' => 'Mazda', 'JM1' => 'Mazda',
        'SJN' => 'Nissan', 'VSK' => 'Nissan', 'JN1' => 'Nissan',
        'TSM' => 'Suzuki', 'JSA' => 'Suzuki', 'MMS' => 'Suzuki',
        'YV1' => 'Volvo', 'YV4' => 'Volvo', 'LVY' => 'Volvo',
        'JMB' => 'Mitsubishi', 'JA3' => 'Mitsubishi',
        'JF1' => 'Subaru', 'JF2' => 'Subaru',
        'JTH' => 'Lexus', 'JTJ' => 'Lexus',
        '1C4' => 'Jeep', '1J4' => 'Jeep', 'ZAC' => 'Jeep',
        'SAL' => 'Land Rover',
        'WP0' => 'Porsche', 'WP1' => 'Porsche',
        'WMW' => 'Mini',
        'ZAR' => 'Alfa Romeo',
        'SAJ' => 'Jaguar', 'SAD' => 'Jaguar',
        '5YJ' => 'Tesla', 'LRW' => 'Tesla', 'XP7' => 'Tesla',
    ];

    /**
     * Makers whose 10th character is a model year on European cars. Mercedes (steering
     * code), BMW, Ford, Toyota, Renault, PSA, Dacia, Fiat, Nissan, Suzuki, Mini put
     * something else there, so they are deliberately left out.
     */
    private const MODEL_YEAR_MAKES = ['Škoda', 'Volkswagen', 'Audi', 'Seat', 'Cupra', 'Opel', 'Hyundai', 'Kia', 'Honda', 'Volvo', 'Subaru', 'Jeep', 'Land Rover', 'Porsche', 'Jaguar', 'Tesla'];

    private const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';

    /**
     * VW group: model code at chars 7–8. Entry = name | [candidates…] | [fromYear => name | [candidates…]].
     * A "Cupra:" prefix moves the car to that make (Cupra shares Seat's WMI).
     */
    private const VAG = [
        'Škoda' => [
            '6U' => 'Felicia', '1U' => 'Octavia I', '1Z' => 'Octavia II', 'NE' => 'Octavia III', 'NX' => 'Octavia IV',
            '6Y' => 'Fabia I', '5J' => ['Fabia II', 'Roomster', 'Praktik'], 'NJ' => 'Fabia III', 'PJ' => 'Fabia IV',
            '3U' => 'Superb I', '3T' => 'Superb II', '3V' => 'Superb III', '3Y' => 'Superb IV',
            '5L' => 'Yeti', 'NS' => [0 => 'Kodiaq I', 2024 => 'Kodiaq II'], 'NU' => 'Karoq', 'NH' => 'Rapid',
            'NW' => ['Scala', 'Kamiq'], 'NY' => 'Enyaq', 'AA' => 'Citigo',
        ],
        'Volkswagen' => [
            '6X' => 'Lupo', '5Z' => 'Fox', 'AA' => 'Up!', '6N' => 'Polo III', '9N' => 'Polo IV', '6R' => 'Polo V', '6C' => 'Polo V', 'AW' => 'Polo VI',
            '1H' => ['Golf III', 'Vento'], '1J' => ['Golf IV', 'Bora'], '1K' => ['Golf V', 'Jetta V'], '5K' => 'Golf VI', 'AU' => 'Golf VII', 'CD' => 'Golf VIII',
            '5M' => 'Golf Plus', 'AM' => 'Golf Sportsvan', '16' => 'Jetta VI',
            '31' => 'Passat B3/B4', '3A' => 'Passat B3/B4', '3B' => 'Passat B5', '3C' => [0 => 'Passat B6', 2011 => 'Passat B7'], '3G' => 'Passat B8',
            '35' => [0 => 'Passat CC', 2012 => 'CC'], '3H' => 'Arteon', '3D' => 'Phaeton', '1F' => 'Eos', '13' => 'Scirocco III', '9C' => 'New Beetle', '1Y' => 'New Beetle', '5C' => 'Beetle',
            '1T' => 'Touran I', '5T' => 'Touran II', '7M' => 'Sharan I', '7N' => 'Sharan II',
            'C1' => 'T-Cross', 'CS' => 'Taigo', 'A1' => 'T-Roc', '5N' => [0 => 'Tiguan I', 2016 => ['Tiguan II', 'Tiguan Allspace']], 'CT' => 'Tiguan III',
            '7L' => 'Touareg I', '7P' => 'Touareg II', 'CR' => 'Touareg III',
            'E1' => 'ID.3', 'E2' => ['ID.4', 'ID.5'], 'E3' => 'ID.7', 'EB' => 'ID. Buzz',
            '9K' => 'Caddy II', '2K' => [0 => 'Caddy III', 2016 => 'Caddy IV'], 'SB' => 'Caddy V', 'SK' => 'Caddy V',
            '70' => 'Transporter T4', '7H' => [0 => 'Transporter T5', 2016 => 'Transporter T6', 2020 => 'Transporter T6.1'], '7J' => [0 => 'Transporter T5', 2016 => 'Transporter T6', 2020 => 'Transporter T6.1'],
            'ST' => 'Multivan T7', '2D' => 'LT', '2E' => 'Crafter I', '2F' => 'Crafter I', 'SY' => 'Crafter II', 'SZ' => 'Crafter II', '2H' => 'Amarok I',
        ],
        'Audi' => [
            '8C' => '80 (B4)', '8X' => 'A1 (8X)', 'GB' => 'A1 (GB)', '8Z' => 'A2', '8L' => 'A3 (8L)', '8P' => 'A3 (8P)', '8V' => 'A3 (8V)', '8Y' => 'A3 (8Y)',
            '8D' => 'A4 (B5)', '8E' => [0 => 'A4 (B6)', 2005 => 'A4 (B7)'], '8H' => 'A4 (B6)', '8K' => 'A4 (B8)', '8W' => 'A4 (B9)', '8T' => 'A5 (8T)', '8F' => 'A5 (8T)', 'F5' => 'A5 (F5)',
            '4A' => 'A6 (C4)', '4B' => 'A6 (C5)', '4F' => 'A6 (C6)', '4G' => ['A6 (C7)', 'A7 (4G)'], '4K' => ['A6 (C8)', 'A7 (4K)'],
            '4E' => 'A8 (D3)', '4H' => 'A8 (D4)', '4N' => 'A8 (D5)', '8N' => 'TT (8N)', '8J' => 'TT (8J)', 'FV' => 'TT (8S)',
            'GA' => 'Q2', '8U' => 'Q3 (8U)', 'F3' => 'Q3 (F3)', 'F4' => 'Q4 e-tron', '8R' => 'Q5 (8R)', 'FY' => 'Q5 (FY)', '4L' => 'Q7 (4L)', '4M' => ['Q7 (4M)', 'Q8'], 'GE' => ['e-tron', 'Q8 e-tron'],
        ],
        'Seat' => [
            '6J' => 'Ibiza IV', 'KJ' => ['Ibiza V', 'Arona'], '1P' => 'Leon II', '5F' => 'Leon III', 'KL' => ['Leon IV', 'Cupra:Leon'],
            'NH' => 'Toledo IV', 'KH' => ['Ateca', 'Cupra:Ateca'], '7N' => 'Alhambra II', 'KM' => 'Cupra:Formentor', 'K1' => 'Cupra:Born',
        ],
    ];

    /** Mercedes: series (Baureihe) at chars 4–6; 247 is the B-Class on W1K/WDD and the GLA on W1N/WDC. */
    private const MERCEDES = [
        '169' => 'A (W169)', '176' => 'A (W176)', '177' => 'A (W177)', '245' => 'B (W245)', '246' => 'B (W246)',
        '203' => 'C (W203)', '204' => 'C (W204)', '205' => 'C (W205)', '206' => 'C (W206)',
        '211' => 'E (W211)', '212' => 'E (W212)', '213' => 'E (W213)', '117' => 'CLA (C117)', '118' => 'CLA (C118)',
        '156' => 'GLA (X156)', '253' => 'GLC (X253)', '254' => 'GLC (X254)', '164' => 'ML (W164)', '166' => 'ML/GLE (W166)', '167' => 'GLE (V167)',
        '639' => 'Vito (W639)', '447' => 'Vito (W447)', '906' => 'Sprinter (W906)', '907' => 'Sprinter (W907)', '910' => 'Sprinter (W907)',
    ];

    /** Renault: model code at chars 4–6 (newer) or 4–5. */
    private const RENAULT = [
        'RJA' => 'Clio V', 'RJB' => 'Captur II', 'RFB' => 'Megane IV', 'RFA' => 'Scenic IV', 'RFE' => 'Kadjar', 'RFD' => 'Talisman', 'RFC' => 'Espace V',
        'C06' => 'Twingo I', 'CN' => 'Twingo II', 'AH' => 'Twingo III', 'AG' => 'Zoe',
        'B57' => 'Clio I', 'C57' => 'Clio I', 'S57' => 'Clio I', 'BB' => 'Clio II', 'CB' => 'Clio II', 'SB' => 'Clio II', 'BR' => 'Clio III', 'CR' => 'Clio III', 'KR' => 'Clio III', 'BH' => 'Clio IV', 'KH' => 'Clio IV',
        'LB' => 'Thalia I', 'LU' => 'Thalia II', 'JP' => 'Modus', 'FP' => 'Modus',
        'BA' => 'Megane I', 'DA' => 'Megane I', 'LA' => 'Megane I', 'KA' => 'Megane I', 'EA' => 'Megane I',
        'BM' => 'Megane II', 'CM' => 'Megane II', 'LM' => 'Megane II', 'KM' => 'Megane II', 'EM' => 'Megane II',
        'BZ' => 'Megane III', 'DZ' => 'Megane III', 'KZ' => 'Megane III', 'EZ' => 'Megane III', 'LZ' => 'Fluence',
        'JA' => 'Scenic I', 'JM' => 'Scenic II', 'JZ' => 'Scenic III',
        'B56' => 'Laguna I', 'K56' => 'Laguna I', 'BG' => 'Laguna II', 'KG' => 'Laguna II', 'BT' => 'Laguna III', 'KT' => 'Laguna III', 'BJ' => 'Vel Satis',
        'JE' => 'Espace III', 'JK' => 'Espace IV', 'KC' => 'Kangoo I', 'FC' => 'Kangoo I', 'KW' => 'Kangoo II', 'FW' => 'Kangoo II',
        '2R' => 'Captur I', 'VY' => 'Koleos I',
        'FD' => 'Master II', 'JD' => 'Master II', 'ED' => 'Master II', 'MA' => 'Master III', 'FL' => ['Trafic II', 'Trafic III'], 'JL' => ['Trafic II', 'Trafic III'],
    ];

    private const DACIA = [
        'LSD' => ['Logan I', 'Logan II'], 'KSD' => 'Logan MCV', 'BSD' => 'Sandero I', '5SD' => 'Sandero II',
        'HSD' => 'Duster I', 'HJD' => 'Duster II', 'JSD' => 'Lodgy',
    ];

    /** PSA: model family letter at char 4. */
    private const PEUGEOT = [
        '2' => '206', 'W' => '207', 'C' => '208 I', 'U' => '208 II', '3' => '307', '4' => '308 I', 'L' => ['308 II', '308 III'],
        '0' => '3008 I', 'M' => ['3008 II', '5008 II'], '8' => '508 I', 'F' => '508 II', 'G' => 'Partner', 'Y' => 'Boxer',
    ];

    private const CITROEN = [
        'S' => ['C3 II', 'C3 III'], 'L' => 'C4 I', 'N' => 'C4 II', 'R' => 'C5 II', 'G' => ['Berlingo II', 'Berlingo III'], 'V' => 'Jumpy III', 'Y' => 'Jumper',
    ];

    /** Fiat / Alfa: type code at chars 4–6. */
    private const FIAT = [
        '188' => 'Punto II', '199' => 'Punto III (Grande/Evo)', '312' => '500', '169' => 'Panda II', '319' => 'Panda III',
        '356' => 'Tipo', '263' => 'Doblo II', '250' => 'Ducato',
    ];

    private const ALFA = ['939' => '159', '940' => 'Giulietta', '952' => 'Giulia', '949' => 'Stelvio'];

    /** Volvo: model code at chars 4–5. */
    private const VOLVO = ['MV' => 'V40 II', 'FW' => 'V60 I', 'ZW' => 'V60 II', 'FS' => 'S60 II', 'BW' => 'V70 III', 'DZ' => 'XC60 I', 'RZ' => 'XC60 II'];

    /** Porsche: model code at chars 7–8 (VAG style). */
    private const PORSCHE = ['99' => [0 => '911 (997)', 2012 => '911 (991)', 2020 => '911 (992)'], '9P' => 'Cayenne (955/957)', '92' => 'Cayenne (958)', '9Y' => 'Cayenne (9YA)', '95' => 'Macan'];

    /** Land Rover: model letter at char 4. */
    private const LAND_ROVER = ['V' => 'Range Rover Evoque I', 'Z' => 'Range Rover Evoque II', 'F' => 'Freelander 2', 'C' => 'Discovery Sport'];

    /**
     * @return array{valid: bool, make: string|null, year: int|null, models: list<string>}
     */
    public static function decode(string $vin): array
    {
        $vin = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $vin) ?? '');
        if (strlen($vin) !== 17 || preg_match('/[IOQ]/', $vin)) {
            return ['valid' => false, 'make' => null, 'year' => null, 'models' => []];
        }

        $wmi = substr($vin, 0, 3);
        $make = self::WMI[$wmi] ?? null;
        $year = $make && in_array($make, self::MODEL_YEAR_MAKES, true) ? self::modelYear($vin[9]) : null;

        $models = [];
        foreach (self::candidates($make, $wmi, $vin, $year) as $name) {
            if (str_starts_with($name, 'Cupra:')) {
                $make = 'Cupra';
                $name = substr($name, 6);
            }
            $models[] = $name;
        }

        return ['valid' => true, 'make' => $make, 'year' => $year, 'models' => array_values(array_unique($models))];
    }

    private static function modelYear(string $code): ?int
    {
        $pos = strpos(self::YEAR_CODES, $code);
        if ($pos === false) {
            return null;
        }
        // Letters: A=2010 … Y=2030; digits: 1=2001 … 9=2009. The 1980–2000 cycle is out of scope for a workshop app.
        $year = $pos < 21 ? 2010 + $pos : 2001 + ($pos - 21);

        return $year > (int) date('Y') + 1 ? $year - 30 : $year;
    }

    /** @return list<string> */
    private static function candidates(?string $make, string $wmi, string $vin, ?int $year): array
    {
        $entry = match ($make) {
            'Škoda', 'Volkswagen', 'Audi', 'Seat' => self::VAG[$make][substr($vin, 6, 2)] ?? null,
            'Mercedes-Benz' => self::mercedes($wmi, substr($vin, 3, 3)),
            'Renault' => self::RENAULT[substr($vin, 3, 3)] ?? self::RENAULT[substr($vin, 3, 2)] ?? null,
            'Dacia' => self::DACIA[substr($vin, 3, 3)] ?? null,
            'Peugeot' => self::PEUGEOT[$vin[3]] ?? null,
            'Citroën' => self::CITROEN[$vin[3]] ?? null,
            'Fiat' => self::FIAT[substr($vin, 3, 3)] ?? null,
            'Alfa Romeo' => self::ALFA[substr($vin, 3, 3)] ?? null,
            'Volvo' => self::VOLVO[substr($vin, 3, 2)] ?? null,
            'Porsche' => self::PORSCHE[substr($vin, 6, 2)] ?? null,
            'Land Rover' => self::LAND_ROVER[$vin[3]] ?? null,
            'Jaguar' => self::jaguar($wmi, $vin[3]),
            'Tesla' => match ($vin[3]) {
                '3' => 'Model 3', 'Y' => 'Model Y', 'S' => 'Model S', 'X' => 'Model X', default => null
            },
            'Jeep' => $wmi === '1C4' && substr($vin, 3, 2) === 'RJ' ? 'Grand Cherokee WK2' : null,
            'Opel' => self::opel($vin),
            default => null,
        };

        if ($entry === null) {
            return [];
        }
        if (is_string($entry)) {
            return [$entry];
        }
        if (array_is_list($entry)) {
            return $entry;
        }
        // Year thresholds: the generation that was current for the model year; all of them when the year is unknown.
        if ($year === null) {
            return array_merge(...array_map(fn ($v) => (array) $v, array_values($entry)));
        }
        ksort($entry);
        $pick = null;
        foreach ($entry as $from => $name) {
            if ($year >= $from) {
                $pick = $name;
            }
        }

        return (array) ($pick ?? reset($entry));
    }

    private static function mercedes(string $wmi, string $series): string|array|null
    {
        if ($series === '247') {
            return in_array($wmi, ['W1N', 'WDC'], true) ? 'GLA (H247)' : 'B (W247)';
        }

        return self::MERCEDES[$series] ?? null;
    }

    private static function jaguar(string $wmi, string $code): ?string
    {
        if ($wmi === 'SAD') {
            return match ($code) {
                'C' => 'F-Pace', 'F' => 'E-Pace', default => null
            };
        }

        return match ($code) {
            'A' => 'XE', 'B' => 'XF (X260)', default => null
        };
    }

    /** Opel used two schemes: "0" + three-letter code (pre-2009) and a two-letter code at chars 4–5. */
    private static function opel(string $vin): string|array|null
    {
        if ($vin[3] === '0') {
            return match (substr($vin, 4, 3)) {
                'AHL' => 'Astra H', 'AHM' => 'Zafira B', 'SDL' => 'Corsa D', 'XEP' => 'Corsa E', 'XCF' => 'Meriva A', default => null,
            };
        }

        return match (substr($vin, 3, 2)) {
            'PD', 'PE', 'PF' => 'Astra J', 'BD', 'BE', 'BF' => 'Astra K', 'SD' => 'Meriva B', 'PE' => 'Zafira C Tourer', default => null,
        };
    }
}
