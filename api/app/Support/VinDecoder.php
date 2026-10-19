<?php

namespace App\Support;

/**
 * Offline VIN decoder. Standard part: manufacturer (WMI, chars 1–3). Maker-specific part:
 * the model year (char 10 for most makers; char 11 on Ford of Europe; only letters on the
 * Fiat group and on PSA since ~2008; never on Toyota, Renault, Nissan, Suzuki or EU Mazdas)
 * and the model generation, which lives in the VDS (chars 4–9) in each maker's own scheme.
 *
 * Every maker is a SCHEMES entry: the character windows to try (1-based start, length) and
 * the code table, or a list of such schemes tried in order; rules that need more than a table
 * (a WMI that changes the scheme, a plant or body letter that splits two models) live in
 * special(). A name may carry a "Make:" prefix when the VIN belongs to another make than its
 * WMI says (Cupra on Seat's WMI, DS on Citroën's, a Kia Venga built by Hyundai in Nošovice).
 * The tables were built from real VINs in the Czech vehicle register, EU recall lists and
 * auction records; anything else gets make (+ year), and the model is a hint, never gospel.
 */
final class VinDecoder
{
    /** WMI prefix → make name in the catalogue. */
    private const WMI = [
        'TMB' => 'Škoda', 'TMP' => 'Škoda',
        'WVW' => 'Volkswagen', 'WVG' => 'Volkswagen', 'WV1' => 'Volkswagen', 'WV2' => 'Volkswagen', 'WV3' => 'Volkswagen', 'XW8' => 'Volkswagen',
        'WAU' => 'Audi', 'WA1' => 'Audi', 'WUA' => 'Audi',
        'WBA' => 'BMW', 'WBS' => 'BMW', 'WBY' => 'BMW', 'WBX' => 'BMW', '5UX' => 'BMW', '5YM' => 'BMW', '4US' => 'BMW', '3MW' => 'BMW',
        'WDB' => 'Mercedes-Benz', 'WDC' => 'Mercedes-Benz', 'WDD' => 'Mercedes-Benz', 'WDF' => 'Mercedes-Benz', 'W1K' => 'Mercedes-Benz', 'W1N' => 'Mercedes-Benz', 'W1V' => 'Mercedes-Benz',
        'W0L' => 'Opel', 'W0V' => 'Opel', 'VXK' => 'Opel', 'VXE' => 'Opel',
        'WF0' => 'Ford', 'WF1' => 'Ford', 'NM0' => 'Ford', 'VS6' => 'Ford', 'SFA' => 'Ford', 'MAJ' => 'Ford', '1FA' => 'Ford', '1FM' => 'Ford', '3FA' => 'Ford', '1ZV' => 'Ford',
        'VF1' => 'Renault', 'VF6' => 'Renault', 'VF8' => 'Renault',
        'VF3' => 'Peugeot', 'VR3' => 'Peugeot',
        'VF7' => 'Citroën', 'VR7' => 'Citroën',
        'UU1' => 'Dacia',
        'SB1' => 'Toyota', 'JTD' => 'Toyota', 'JTE' => 'Toyota', 'JTM' => 'Toyota', 'JTN' => 'Toyota', 'NMT' => 'Toyota', 'VNK' => 'Toyota', 'YAR' => 'Toyota', 'AHT' => 'Toyota', 'MR0' => 'Toyota',
        'KMH' => 'Hyundai', 'TMA' => 'Hyundai', 'NLH' => 'Hyundai', 'MAL' => 'Hyundai', 'KMF' => 'Hyundai', 'KM8' => 'Hyundai', '5NP' => 'Hyundai', '5NM' => 'Hyundai',
        'KNA' => 'Kia', 'KNE' => 'Kia', 'U5Y' => 'Kia', 'U6Y' => 'Kia', 'KND' => 'Kia', '5XY' => 'Kia', '5XX' => 'Kia', '3KP' => 'Kia',
        'VSS' => 'Seat',
        'ZFA' => 'Fiat', 'ZFC' => 'Fiat',
        'SHH' => 'Honda', 'JHM' => 'Honda', 'NLA' => 'Honda', 'SHS' => 'Honda', 'LUC' => 'Honda', 'MRH' => 'Honda',
        'JMZ' => 'Mazda', 'JM1' => 'Mazda', 'JM3' => 'Mazda', '3MZ' => 'Mazda', '3MD' => 'Mazda', '3MV' => 'Mazda',
        'SJN' => 'Nissan', 'VSK' => 'Nissan', 'JN1' => 'Nissan', 'VNV' => 'Nissan', '3N1' => 'Nissan', 'MDH' => 'Nissan', 'JN8' => 'Nissan',
        'JNK' => 'Infiniti', 'JNR' => 'Infiniti', 'SJK' => 'Infiniti',
        'TSM' => 'Suzuki', 'JSA' => 'Suzuki', 'MMS' => 'Suzuki', 'MBH' => 'Suzuki', 'MA3' => 'Suzuki',
        'YV1' => 'Volvo', 'YV4' => 'Volvo', 'LVY' => 'Volvo', 'LYV' => 'Volvo', '7JR' => 'Volvo',
        'JMB' => 'Mitsubishi', 'JA3' => 'Mitsubishi', 'JMA' => 'Mitsubishi', 'MMB' => 'Mitsubishi', 'MMT' => 'Mitsubishi', 'XMC' => 'Mitsubishi',
        'JF1' => 'Subaru', 'JF2' => 'Subaru', '4S4' => 'Subaru', '4S3' => 'Subaru',
        'JTH' => 'Lexus', 'JTJ' => 'Lexus',
        '1C4' => 'Jeep', '1J4' => 'Jeep', 'ZAC' => 'Jeep', '3C4' => 'Jeep',
        'SAL' => 'Land Rover',
        'WP0' => 'Porsche', 'WP1' => 'Porsche',
        'WMW' => 'Mini', 'WMZ' => 'Mini',
        'ZAR' => 'Alfa Romeo',
        'SAJ' => 'Jaguar', 'SAD' => 'Jaguar',
        '5YJ' => 'Tesla', 'LRW' => 'Tesla', 'XP7' => 'Tesla',
        'ZLA' => 'Lancia',
        'VR1' => 'DS',
    ];

    /** North-American builds: the make and the model year (char 10) are certain, the VDS does not follow the European tables. */
    private const MAKE_ONLY_WMIS = ['KM8', '5NP', '5NM', 'KND', '5XY', '5XX', '3KP', '1FA', '1FM', '3FA', '1ZV', '4S3'];

    /** Makes whose 10th character is the model year on European cars ("0" there simply means not encoded). */
    private const MODEL_YEAR_MAKES = ['Škoda', 'Volkswagen', 'Audi', 'Seat', 'Cupra', 'Opel', 'Hyundai', 'Kia', 'Honda', 'Volvo', 'Subaru', 'Jeep', 'Land Rover', 'Porsche', 'Jaguar', 'Tesla', 'Infiniti', 'BMW', 'Mini', 'Mitsubishi'];

    /** Fiat group: char 10 is a model year only when it is a letter; old-scheme VINs carry a serial digit there. */
    private const LETTER_YEAR_MAKES = ['Fiat', 'Alfa Romeo', 'Lancia'];

    /** PSA from ~2008: a letter at char 10, or 8/9 followed by the plant letter; older VINs carry a serial digit there. */
    private const PSA_MAKES = ['Peugeot', 'Citroën', 'DS'];

    /** Ford of Europe: char 10 repeats the body letter, the model year is at char 11. */
    private const FORD_EU_WMIS = ['WF0', 'WF1', 'NM0', 'VS6', 'SFA'];

    /** Mazda: only North-American-spec VINs carry a model year; EU JMZ VINs have a frame-number sequence there. */
    private const MAZDA_YEAR_WMIS = ['JM1', 'JM3', '3MZ', '3MD', '3MV'];

    /** Makes a table value may move the car to with a "Make:" prefix. */
    private const PREFIX_MAKES = ['Cupra', 'Kia', 'Hyundai', 'Dacia', 'DS', 'Fiat', 'Dodge'];

    private const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';

    /**
     * Per maker: the VDS windows to try in order ([1-based start, length]) and the code table, or a
     * list of such schemes (e.g. one per era, each with its own windows) tried in order.
     * Table value = name | [candidates…] | [fromYear => name | [candidates…]] (year split: the
     * generation current for the model year; all of them when the VIN carries no year).
     *
     * @var array<string, array{at: list<array{0: int, 1: int}>, codes: array<string, mixed>}|list<array{at: list<array{0: int, 1: int}>, codes: array<string, mixed>}>>
     */
    private const SCHEMES = [
        'Škoda' => ['at' => [[7, 2]], 'codes' => [
            '1U' => 'Octavia I', '1Z' => 'Octavia II', '3T' => 'Superb II', '3U' => 'Superb I', '3V' => 'Superb III', '3Y' => 'Superb IV',
            '5J' => ['Fabia II', 'Roomster', 'Praktik'], '5L' => 'Yeti', '6U' => 'Felicia', '6Y' => 'Fabia I', 'AA' => 'Citigo', 'NE' => 'Octavia III',
            'NH' => 'Rapid', 'NJ' => 'Fabia III', 'NS' => [0 => 'Kodiaq I', 2024 => 'Kodiaq II'], 'NU' => 'Karoq', 'NW' => ['Scala', 'Kamiq'], 'NX' => 'Octavia IV',
            'NY' => 'Enyaq', 'PJ' => 'Fabia IV',
        ]],
        'Volkswagen' => ['at' => [[7, 2]], 'codes' => [
            '13' => 'Scirocco III', '16' => 'Jetta VI', '1F' => 'Eos', '1H' => ['Golf III', 'Vento'], '1J' => ['Golf IV', 'Bora'], '1K' => ['Golf V', 'Jetta V'],
            '1T' => 'Touran I', '1Y' => 'New Beetle', '2D' => 'LT', '2E' => 'Crafter I', '2F' => 'Crafter I', '2H' => 'Amarok I',
            '2K' => [0 => 'Caddy III', 2016 => 'Caddy IV'], '31' => 'Passat B3/B4', '35' => [0 => 'Passat CC', 2012 => 'CC'], '3A' => 'Passat B3/B4', '3B' => 'Passat B5', '3C' => [0 => 'Passat B6', 2011 => 'Passat B7'],
            '3D' => 'Phaeton', '3G' => 'Passat B8', '3H' => 'Arteon', '5C' => 'Beetle', '5K' => 'Golf VI', '5M' => 'Golf Plus',
            '5N' => [0 => 'Tiguan I', 2016 => ['Tiguan II', 'Tiguan Allspace']], '5T' => 'Touran II', '5Z' => 'Fox', '6C' => 'Polo V', '6N' => 'Polo III', '6R' => 'Polo V',
            '6X' => 'Lupo', '70' => 'Transporter T4', '7H' => [0 => 'Transporter T5', 2016 => 'Transporter T6', 2020 => 'Transporter T6.1'], '7J' => [0 => 'Transporter T5', 2016 => 'Transporter T6', 2020 => 'Transporter T6.1'], '7L' => 'Touareg I', '7M' => 'Sharan I',
            '7N' => 'Sharan II', '7P' => 'Touareg II', '9C' => 'New Beetle', '9K' => 'Caddy II', '9N' => 'Polo IV', 'A1' => 'T-Roc',
            'AA' => 'Up!', 'AM' => 'Golf Sportsvan', 'AU' => 'Golf VII', 'AW' => 'Polo VI', 'C1' => 'T-Cross', 'CD' => 'Golf VIII',
            'CR' => 'Touareg III', 'CS' => 'Taigo', 'CT' => 'Tiguan III', 'E1' => 'ID.3', 'E2' => ['ID.4', 'ID.5'], 'E3' => 'ID.7',
            'EB' => 'ID. Buzz', 'SB' => 'Caddy V', 'SK' => 'Caddy V', 'ST' => 'Multivan T7', 'SY' => 'Crafter II', 'SZ' => 'Crafter II',
        ]],
        'Audi' => ['at' => [[7, 2]], 'codes' => [
            '4A' => 'A6 (C4)', '4B' => 'A6 (C5)', '4E' => 'A8 (D3)', '4F' => 'A6 (C6)', '4G' => ['A6 (C7)', 'A7 (4G)'], '4H' => 'A8 (D4)',
            '4K' => ['A6 (C8)', 'A7 (4K)'], '4L' => 'Q7 (4L)', '4M' => ['Q7 (4M)', 'Q8'], '4N' => 'A8 (D5)', '8C' => '80 (B4)', '8D' => 'A4 (B5)',
            '8E' => [0 => 'A4 (B6)', 2005 => 'A4 (B7)'], '8F' => 'A5 (8T)', '8H' => 'A4 (B6)', '8J' => 'TT (8J)', '8K' => 'A4 (B8)', '8L' => 'A3 (8L)',
            '8N' => 'TT (8N)', '8P' => 'A3 (8P)', '8R' => 'Q5 (8R)', '8T' => 'A5 (8T)', '8U' => 'Q3 (8U)', '8V' => 'A3 (8V)',
            '8W' => 'A4 (B9)', '8X' => 'A1 (8X)', '8Y' => 'A3 (8Y)', '8Z' => 'A2', 'F3' => 'Q3 (F3)', 'F4' => 'Q4 e-tron',
            'F5' => 'A5 (F5)', 'FV' => 'TT (8S)', 'FY' => 'Q5 (FY)', 'GA' => 'Q2', 'GB' => 'A1 (GB)', 'GE' => ['e-tron', 'Q8 e-tron'],
        ]],
        'Seat' => ['at' => [[7, 2]], 'codes' => [
            '1P' => 'Leon II', '5F' => 'Leon III', '6J' => 'Ibiza IV', '7N' => 'Alhambra II', 'K1' => 'Cupra:Born', 'KH' => ['Ateca', 'Cupra:Ateca'],
            'KJ' => ['Ibiza V', 'Arona'], 'KL' => ['Leon IV', 'Cupra:Leon'], 'KM' => 'Cupra:Formentor', 'NH' => 'Toledo IV',
        ]],
        'Porsche' => ['at' => [[7, 2]], 'codes' => [
            '92' => 'Cayenne (958)', '95' => 'Macan', '99' => [0 => '911 (997)', 2012 => '911 (991)', 2020 => '911 (992)'], '9P' => [0 => 'Cayenne (955)', 2008 => 'Cayenne (957)'], '9Y' => 'Cayenne (9YA)',
        ]],
        'Mercedes-Benz' => ['at' => [[4, 3]], 'codes' => [
            '117' => 'CLA (C117)', '118' => 'CLA (C118)', '156' => 'GLA (X156)', '164' => 'ML (W164)', '166' => 'ML/GLE (W166)', '167' => 'GLE (V167)',
            '169' => 'A (W169)', '176' => 'A (W176)', '177' => 'A (W177)', '203' => 'C (W203)', '204' => 'C (W204)', '205' => 'C (W205)',
            '206' => 'C (W206)', '211' => 'E (W211)', '212' => 'E (W212)', '213' => 'E (W213)', '245' => 'B (W245)', '246' => 'B (W246)',
            '253' => 'GLC (X253)', '254' => 'GLC (X254)', '447' => 'Vito (W447)', '639' => 'Vito (W639)', '906' => 'Sprinter (W906)', '907' => 'Sprinter (W907)',
            '910' => 'Sprinter (W907)',
        ]],
        'Renault' => ['at' => [[4, 3], [4, 2]], 'codes' => [
            '4FL' => 'Trafic III', 'B56' => 'Laguna I', 'B57' => 'Clio I', 'C06' => 'Twingo I', 'C57' => 'Clio I', 'HJD' => 'Dacia:Duster II',
            'JL0' => 'Trafic III', 'K56' => 'Laguna I', 'R98' => 'Clio V', 'RCB' => [0 => 'Megane E-Tech', 2024 => ['Megane E-Tech', 'Scenic E-Tech']], 'RFA' => 'Scenic IV', 'RFB' => 'Megane IV',
            'RFC' => 'Espace V', 'RFD' => 'Talisman', 'RFE' => 'Kadjar', 'RFK' => 'Kangoo III', 'RHN' => 'Austral', 'RJA' => 'Clio V',
            'RJB' => 'Captur II', 'RJK' => 'Express', 'RJL' => 'Arkana', 'S57' => 'Clio I', 'VF0' => ['Master III', 'Master IV'], '2R' => 'Captur I',
            '5R' => 'Clio IV', '7R' => 'Clio IV', 'AG' => 'Zoe', 'AH' => 'Twingo III', 'BA' => 'Megane I', 'BB' => 'Clio II',
            'BG' => 'Laguna II', 'BH' => 'Clio IV', 'BJ' => 'Vel Satis', 'BM' => 'Megane II', 'BR' => 'Clio III', 'BT' => 'Laguna III',
            'BZ' => 'Megane III', 'CB' => 'Clio II', 'CM' => 'Megane II', 'CN' => 'Twingo II', 'CR' => 'Clio III', 'DA' => 'Megane I',
            'DZ' => 'Megane III', 'EA' => 'Megane I', 'ED' => 'Master II', 'EM' => 'Megane II', 'EZ' => 'Megane III', 'FC' => 'Kangoo I',
            'FD' => 'Master II', 'FL' => ['Trafic II', 'Trafic III'], 'FP' => 'Modus', 'FW' => 'Kangoo II', 'HD' => 'Master II', 'JA' => 'Scenic I',
            'JD' => 'Master II', 'JE' => 'Espace III', 'JK' => 'Espace IV', 'JL' => 'Trafic II', 'JM' => 'Scenic II', 'JP' => 'Modus',
            'JZ' => 'Scenic III', 'KA' => 'Megane I', 'KC' => 'Kangoo I', 'KG' => 'Laguna II', 'KH' => 'Clio IV', 'KM' => 'Megane II',
            'KR' => 'Clio III', 'KT' => 'Laguna III', 'KW' => 'Kangoo II', 'KZ' => 'Megane III', 'LA' => 'Megane I', 'LB' => 'Thalia I',
            'LM' => 'Megane II', 'LU' => 'Thalia II', 'LZ' => 'Fluence', 'MA' => 'Master III', 'MB' => 'Master III', 'MF' => 'Master III',
            'ML' => 'Master III', 'SB' => 'Clio II', 'VA' => 'Master III', 'VB' => 'Master III', 'VG' => 'Master III', 'VY' => 'Koleos I',
        ]],
        'Dacia' => ['at' => [[4, 3]], 'codes' => [
            '0SD' => 'Dokker', '5SD' => 'Sandero II', '8SD' => 'Dokker Van', 'BSD' => 'Sandero I', 'DJF' => ['Sandero III', 'Jogger', 'Duster III'], 'F67' => 'Dokker Van',
            'FSD' => 'Logan Van', 'HJD' => 'Duster II', 'HSD' => 'Duster I', 'J92' => 'Lodgy', 'JSD' => 'Lodgy', 'K67' => 'Dokker',
            'KSD' => 'Logan MCV I', 'LSD' => ['Logan I', 'Logan II'],
        ]],
        'Peugeot' => ['at' => [[4, 2], [4, 1]], 'codes' => [
            '0E' => '5008 I', '0U' => '3008 I', '23' => 'Boxer', 'AA' => 'Bipper', 'BZ' => 'Expert I', 'CU' => '2008 I',
            'PM' => '107', 'PS' => '108', '0' => ['3008 I', '5008 I'], '2' => '206', '3' => '307', '4' => '308 I',
            '6' => '407', '7' => [0 => '306', 2008 => 'Partner'], '8' => [0 => '406', 2010 => '508 I'], 'B' => 'Expert I', 'C' => '208 I', 'D' => '301',
            'E' => ['Partner', 'Rifter'], 'F' => [0 => '508 II', 2022 => ['308 III', '508 II']], 'G' => 'Partner I', 'L' => '308 II', 'M' => ['3008 II', '5008 II'], 'P' => [0 => '107', 2014 => '108'],
            'U' => ['208 II', '2008 II'], 'V' => ['Expert III', 'Traveller'], 'W' => '207', 'X' => 'Expert II', 'Y' => 'Boxer', 'Z' => 'Boxer',
        ]],
        'Citroën' => ['at' => [[4, 2], [4, 1]], 'codes' => [
            '0P' => 'C4 Cactus', '2R' => 'C3 Aircross I', '3A' => 'C4 Picasso II', 'BZ' => 'Jumpy I', 'NX' => 'DS:DS 4', 'PM' => 'C1 I',
            'PS' => 'C1 II', 'SA' => 'DS:DS 3', 'A' => [0 => 'Nemo', 2018 => 'C5 Aircross I'], 'B' => [0 => 'Jumpy I', 2020 => 'C4 III'], 'C' => [0 => 'Xsara Picasso', 2024 => 'C3 IV'], 'E' => 'Berlingo III',
            'G' => 'Berlingo I', 'L' => 'C4 I', 'M' => 'Berlingo I', 'N' => [0 => 'ZX', 2010 => 'C4 II'], 'P' => [0 => 'C1 I', 2014 => 'C1 II'], 'R' => 'C5 II',
            'S' => [0 => 'C3 II', 2017 => 'C3 III'], 'U' => 'C4 Picasso I', 'V' => ['Jumpy III', 'SpaceTourer'], 'X' => [0 => 'Xantia', 2007 => 'Jumpy II'], 'Y' => 'Jumper', 'Z' => 'Jumper',
        ]],
        'DS' => ['at' => [[4, 1]], 'codes' => [
            'F' => 'DS 4 II', 'J' => 'DS 7 Crossback', 'U' => 'DS 3 Crossback',
        ]],
        'Fiat' => ['at' => [[4, 3]], 'codes' => [
            '169' => 'Panda II', '176' => 'Punto I', '182' => 'Bravo/Brava', '185' => 'Marea', '186' => 'Multipla', '188' => 'Punto II',
            '198' => 'Bravo II', '199' => 'Punto III (Grande/Evo)', '220' => 'Scudo I', '223' => 'Doblo I', '225' => 'Fiorino/Qubo', '230' => 'Ducato II',
            '244' => 'Ducato II', '250' => 'Ducato III', '263' => 'Doblo II', '270' => 'Scudo II', '312' => '500', '319' => 'Panda III',
            '334' => '500X', '356' => 'Tipo', 'CF1' => '500', 'CF7' => 'Tipo', 'FJL' => 'Talento',
        ]],
        'Alfa Romeo' => [
            ['at' => [[4, 3], [4, 2]], 'codes' => [
                'PAH' => 'Stelvio', 'EA' => 'Giulia', 'FA' => 'Giulia',
            ]],
            ['at' => [[4, 3]], 'codes' => [
                '932' => '156', '937' => '147', '939' => ['159', 'Brera/Spider (939)'], '940' => 'Giulietta', '949' => 'Stelvio', '952' => 'Giulia',
                '955' => 'MiTo',
            ]],
        ],
        'Lancia' => ['at' => [[4, 3]], 'codes' => [
            '843' => 'Ypsilon (843)', '846' => 'Ypsilon (846)',
        ]],
        'Volvo' => ['at' => [[4, 2]], 'codes' => [
            '94' => '940', 'AS' => 'S80 II', 'BW' => 'V70 III', 'BZ' => 'XC70 III', 'CM' => 'XC90 I', 'CN' => 'XC90 I',
            'CY' => 'XC90 I', 'CZ' => 'XC90 I', 'DZ' => 'XC60 I', 'FS' => 'S60 II', 'FW' => 'V60 I', 'FZ' => 'V60 Cross Country I',
            'GU' => 'V70 II', 'GV' => 'V70 II', 'HU' => 'S60 I', 'HV' => 'S60 I', 'KU' => 'S80 I', 'KV' => 'S80 I',
            'LF' => 'XC90 II', 'LS' => [0 => '850', 1997 => 'S70'], 'LW' => [0 => '850', 1997 => 'V70 I'], 'LZ' => 'V70 XC', 'MC' => 'C70 II', 'MK' => 'C30',
            'MS' => 'S40 II', 'MV' => 'V40 II', 'MW' => 'V50', 'NC' => 'C70 I', 'NK' => 'C70 I', 'PS' => 'S90 II',
            'PW' => 'V90 II', 'PZ' => 'V90 Cross Country', 'RA' => 'S60 I', 'RH' => 'S60 I', 'RS' => 'S60 I', 'RZ' => 'XC60 II',
            'SD' => 'XC70 II', 'SJ' => 'V70 II', 'SV' => ['V70 II', 'XC70 II'], 'SW' => 'V70 II', 'SZ' => 'XC70 II', 'TA' => 'S80 I',
            'TS' => 'S80 I', 'VS' => 'S40 I', 'VW' => 'V40 I', 'XZ' => ['XC40', 'EX40 (XC40 Recharge)'], 'ZS' => 'S60 III', 'ZW' => 'V60 II',
            'ZZ' => 'V60 Cross Country II',
        ]],
        'Land Rover' => ['at' => [[4, 1]], 'codes' => [
            'C' => 'Discovery Sport', 'F' => 'Freelander 2', 'V' => 'Range Rover Evoque I', 'Z' => 'Range Rover Evoque II',
        ]],
        'Tesla' => ['at' => [[4, 1]], 'codes' => [
            '3' => 'Model 3', 'S' => 'Model S', 'X' => 'Model X', 'Y' => 'Model Y',
        ]],
        'Ford' => [
            ['at' => [[7, 3]], 'codes' => [
                'BBS' => 'Escort VI/VII', 'BDF' => [0 => 'Transit Mk5', 2000 => 'Transit Mk6', 2006 => 'Transit Mk7'], 'ERC' => ['Transit Courier', 'Tourneo Courier'], 'ERJ' => 'B-Max', 'ERK' => [0 => 'EcoSport', 2020 => ['Puma', 'EcoSport']], 'GAB' => 'Cougar',
                'GAE' => 'Puma I', 'GAH' => 'Fiesta VII', 'GAJ' => [0 => 'Fiesta IV', 2002 => 'Fiesta V', 2009 => 'Fiesta VI'], 'GAK' => 'Fiesta VI', 'GBB' => [0 => 'Mondeo II', 2001 => 'Mondeo III', 2007 => 'Mondeo IV'], 'GBW' => ['S-Max I', 'Galaxy II'],
                'GCB' => 'C-Max II', 'GCC' => 'Focus III', 'GCD' => [0 => 'Focus I', 2004 => 'Focus II', 2011 => 'Focus III'], 'GCE' => 'C-Max I', 'GCH' => 'Focus IV', 'GCM' => 'Kuga I',
                'GCS' => 'Escort VI/VII', 'LTR' => 'Ka II', 'PSW' => 'Galaxy I', 'TTF' => [0 => 'Transit Mk5', 2000 => 'Transit Mk6', 2006 => 'Transit Mk7'], 'TTG' => [0 => ['Transit', 'Transit Custom', 'Tourneo Custom'], 2024 => ['Transit', 'Transit Custom II', 'Tourneo Custom II']], 'TTP' => 'Transit Connect I',
                'WPC' => ['Mondeo V', 'S-Max II', 'Galaxy III'], 'WPD' => [0 => 'Focus I', 2004 => 'Focus II'], 'WPG' => ['Transit Connect II', 'Tourneo Connect II'], 'WPJ' => [0 => 'Fiesta IV', 2002 => 'Fiesta V', 2009 => 'Fiesta VI'], 'WPM' => [0 => 'Kuga II', 2020 => 'Kuga III'], 'WPR' => 'Ka I',
            ]],
            ['at' => [[9, 1]], 'codes' => [
                'A' => 'Escort VI/VII', 'B' => ['Mondeo III', 'Mondeo IV', 'C-Max II', 'Cougar'], 'C' => ['Focus III', 'Mondeo V', 'S-Max II', 'Galaxy III', 'Transit Courier'], 'D' => ['Focus I', 'Focus II', 'Focus III'], 'E' => ['C-Max I', 'Puma I'], 'F' => ['Transit Mk6', 'Transit Mk7'],
                'G' => ['Transit', 'Transit Custom', 'Transit Connect II'], 'H' => ['Fiesta VII', 'Focus IV'], 'J' => ['Fiesta V', 'Fiesta VI', 'Fusion', 'B-Max'], 'K' => ['Fiesta VI', 'EcoSport', 'Puma'], 'M' => ['Kuga I', 'Kuga II', 'Kuga III'], 'P' => 'Transit Connect I',
                'R' => ['Ka I', 'Ka II'], 'S' => 'Escort VI/VII', 'W' => ['S-Max I', 'Galaxy II', 'Galaxy I'],
            ]],
        ],
        'Toyota' => [
            ['at' => [[4, 5]], 'codes' => [
                'BC56E' => 'Corolla E15', 'BC58E' => 'Corolla E15', 'BD56E' => 'Corolla E15', 'BE3JE' => 'Corolla E17', 'BM56E' => 'Corolla E15', 'BM58E' => 'Corolla E15',
                'BV56E' => 'Corolla E15', 'BV58E' => 'Corolla E15', 'JB56E' => 'Auris I', 'JC56E' => 'Auris I', 'JC58E' => 'Auris I', 'JD56E' => 'Auris I',
                'JM56E' => 'Auris I', 'JM58E' => 'Auris I', 'JV56E' => 'Auris I', 'JV58E' => 'Auris I', 'KB56E' => 'Auris I', 'KC3C3' => 'Verso-S',
                'KC56E' => 'Auris I', 'KC58E' => 'Auris I', 'KD56E' => 'Auris I', 'KE56E' => 'Auris I', 'KF56E' => 'Auris I', 'KJ3C3' => 'Verso-S',
                'KM56E' => 'Auris I', 'KM58E' => 'Auris I', 'KS56E' => 'Auris I', 'KV56E' => 'Auris I', 'KV58E' => 'Auris I', 'LA56E' => 'Corolla E15',
                'LA58E' => 'Corolla E15', 'LB56E' => 'Corolla E15', 'LB58E' => 'Corolla E15', 'LD56E' => 'Corolla E15', 'LD58E' => 'Corolla E15', 'LF56E' => 'Corolla E15',
                'ME3JE' => 'Auris II', 'MS3JE' => 'Auris II', 'ZE3JE' => 'Auris II', 'ZS3JE' => 'Auris II',
            ]],
            ['at' => [[6, 3]], 'codes' => [
                '10C' => 'Aygo I', '123' => 'Yaris I', '12G' => 'Hilux VII', '183' => 'Yaris I', '18C' => 'Aygo I', '20U' => 'Prius II',
                '22B' => 'Avensis Verso', '22E' => 'Corolla E12', '22G' => 'Hilux VII', '26R' => 'Verso', '28E' => 'Corolla E12', '29J' => 'Land Cruiser 120',
                '31V' => 'RAV4 III', '33V' => 'RAV4 III', '36U' => 'Prius III', '55L' => 'Avensis II', '56E' => ['Auris I', 'Corolla E15'], '56L' => 'Avensis II',
                '58E' => ['Auris I', 'Corolla E15'], '76L' => 'Avensis III', '923' => 'Yaris II', '963' => 'Yaris II', '983' => 'Yaris II',
            ]],
            ['at' => [[7, 2]], 'codes' => [
                'AE' => 'Corolla XII', 'BA' => 'bZ4X', 'BE' => 'Corolla XII', 'BX' => 'C-HR I', 'C3' => 'Yaris IV', 'CC' => 'Hilux VIII',
                'CD' => 'Hilux VIII', 'D3' => 'Yaris III', 'EC' => 'Aygo II', 'EU' => 'Prius+', 'EV' => 'RAV4 IV', 'FB' => 'bZ4X',
                'FV' => 'RAV4 V', 'JE' => ['Auris II', 'Corolla E17'],
            ]],
        ],
        'Lexus' => [
            ['at' => [[4, 5]], 'codes' => [
                'KD5BH' => 'CT', 'P9JBH' => 'UX', 'Y65BH' => 'UX',
            ]],
            ['at' => [[6, 3]], 'codes' => [
                '11A' => 'RX III', '252' => 'IS II', '262' => 'IS II', '31U' => 'RX II', '46F' => 'LS IV', '96S' => 'GS III',
            ]],
            ['at' => [[7, 2]], 'codes' => [
                'B1' => 'ES VII', 'BC' => 'RC', 'BH' => ['CT', 'UX'], 'BL' => 'GS IV', 'BZ' => 'NX I', 'CA' => 'RX IV',
                'D2' => 'IS III',
            ]],
        ],
        'Suzuki' => ['at' => [[4, 2]], 'codes' => [
            'EA' => 'Swift III', 'EY' => 'SX4', 'FJ' => 'Jimny (FJ)', 'FT' => 'Grand Vitara I', 'FY' => 'Fiat:Sedici', 'JT' => 'Grand Vitara II',
            'JY' => 'SX4 S-Cross', 'LY' => 'Vitara (LY)', 'MH' => 'Ignis I', 'MZ' => 'Swift IV',
        ]],
        'Mazda' => ['at' => [[4, 2]], 'codes' => [
            'BA' => '323 (BA)', 'BJ' => '323 (BJ)', 'BK' => '3 (BK)', 'BL' => '3 (BL)', 'BM' => '3 (BM)', 'BN' => '3 (BM)',
            'BP' => '3 (BP)', 'CR' => '5 (CR)', 'CW' => '5 (CW)', 'DE' => '2 (DE)', 'DJ' => '2 (DJ)', 'DK' => 'CX-3',
            'DM' => 'CX-30', 'DY' => '2 (DY)', 'GE' => '626 (GE)', 'GF' => '626 (GF)', 'GG' => '6 (GG)', 'GH' => '6 (GH)',
            'GJ' => '6 (GJ)', 'GL' => '6 (GJ)', 'GW' => '626 (GF)', 'GY' => '6 (GG)', 'KE' => 'CX-5 (KE)', 'KF' => 'CX-5 (KF)',
            'KH' => 'CX-60', 'NC' => 'MX-5 (NC)', 'ND' => 'MX-5 (ND)',
        ]],
        'Honda' => ['at' => [[4, 3], [4, 2]], 'codes' => [
            'FK1' => [0 => 'Civic VIII', 2012 => 'Civic IX'], 'FK2' => [0 => 'Civic VIII', 2012 => 'Civic IX'], 'FK3' => [0 => 'Civic VIII', 2012 => 'Civic IX'], 'FK4' => 'Civic X', 'FK5' => 'Civic X', 'FK6' => 'Civic X',
            'FK7' => 'Civic X', 'FK8' => 'Civic X', 'CU' => 'Accord VIII', 'CW' => 'Accord VIII', 'EP' => 'Civic VII', 'ES' => 'Civic VII',
            'EU' => 'Civic VII', 'EV' => 'Civic VII', 'FC' => 'Civic X', 'FD' => 'Civic VIII', 'FL' => 'Civic XI', 'FN' => 'Civic VIII',
            'GD' => 'Jazz I', 'GE' => 'Jazz II', 'GG' => 'Jazz II', 'GK' => 'Jazz III', 'GR' => 'Jazz IV', 'RD' => [0 => 'CR-V I', 2002 => 'CR-V II'],
            'RE' => 'CR-V III', 'RM' => 'CR-V IV', 'RS' => 'CR-V VI', 'RT' => 'CR-V V', 'RU' => 'HR-V II', 'RV' => 'HR-V III',
            'RW' => 'CR-V V', 'RZ' => 'ZR-V', 'ZE' => 'Insight II', 'ZF' => 'CR-Z',
        ]],
        'Nissan' => [
            ['at' => [[7, 3]], 'codes' => [
                'C11' => 'Tiida C11', 'C13' => 'Pulsar C13', 'D22' => 'Navara D22', 'D23' => 'Navara D23', 'D40' => 'Navara D40', 'E11' => 'Note E11',
                'E12' => 'Note E12', 'F15' => 'Juke F15', 'F16' => 'Juke F16', 'J10' => 'Qashqai J10', 'J11' => 'Qashqai J11', 'J12' => 'Qashqai J12',
                'K11' => 'Micra K11', 'K12' => 'Micra K12', 'K13' => 'Micra K13', 'M20' => 'NV200', 'N15' => 'Almera N15', 'N16' => 'Almera N16',
                'P11' => 'Primera P11', 'P12' => 'Primera P12', 'R20' => 'Terrano II', 'R51' => 'Pathfinder R51', 'T30' => 'X-Trail T30', 'T31' => 'X-Trail T31',
                'T32' => 'X-Trail T32', 'V10' => 'Almera Tino', 'Y61' => 'Patrol Y61', 'Z51' => 'Murano Z51', 'ZE0' => 'Leaf ZE0', 'ZE1' => 'Leaf ZE1',
            ]],
            ['at' => [[4, 3]], 'codes' => [
                'K14' => 'Micra K14', 'T33' => 'X-Trail T33',
            ]],
        ],
        'Infiniti' => [
            ['at' => [[7, 3]], 'codes' => [
                'H15' => ['Q30', 'QX30'], 'J50' => ['EX (J50)', 'QX50 (J50)'], 'S51' => ['FX (S51)', 'QX70 (S51)'], 'V35' => 'G35 (V35)', 'V36' => ['G37 (V36)', 'Q60 (V36)'], 'V37' => ['Q50 (V37)', 'Q60 (V37)'],
                'Y51' => ['M (Y51)', 'Q70 (Y51)'],
            ]],
            ['at' => [[4, 3]], 'codes' => [
                'BV7' => 'Q50 (V37)', 'CV5' => 'G35 (V35)', 'CV6' => 'G37 (V36)', 'CV7' => 'Q50 (V37)',
            ]],
        ],
        'Mitsubishi' => ['at' => [[6, 2]], 'codes' => [
            'A0' => 'Space Star II', 'CU' => 'Outlander I', 'CW' => 'Outlander II', 'CX' => 'Lancer X', 'CY' => 'Lancer X', 'CZ' => 'Lancer X',
            'GA' => 'ASX I', 'GF' => 'Outlander III', 'GG' => 'Outlander III', 'GK' => 'Eclipse Cross', 'KA' => 'L200 IV', 'KB' => 'L200 IV',
            'KJ' => 'L200 V', 'KK' => 'L200 V', 'KL' => 'L200 V', 'NA' => 'Grandis', 'V6' => 'Pajero III', 'V7' => 'Pajero III',
            'V8' => 'Pajero IV', 'V9' => 'Pajero IV', 'Z2' => 'Colt VI', 'Z3' => 'Colt VI',
        ]],
        'Subaru' => ['at' => [[4, 2]], 'codes' => [
            'BD' => 'Legacy II', 'BE' => 'Legacy III', 'BG' => 'Legacy II', 'BH' => ['Legacy III', 'Outback II'], 'BK' => 'Legacy II', 'BL' => 'Legacy IV',
            'BM' => 'Legacy V', 'BP' => ['Legacy IV', 'Outback III'], 'BR' => ['Legacy V', 'Outback IV'], 'BS' => 'Outback BS', 'BT' => 'Outback BT', 'GC' => 'Impreza I',
            'GD' => 'Impreza II', 'GE' => 'Impreza III', 'GF' => 'Impreza I', 'GG' => 'Impreza II', 'GH' => 'Impreza III', 'GJ' => 'Impreza IV',
            'GK' => 'Impreza V', 'GM' => 'Impreza I', 'GP' => ['Impreza IV', 'XV I'], 'GR' => 'Impreza III', 'GT' => ['Impreza V', 'XV II'], 'GU' => ['Impreza VI', 'Crosstrek'],
            'GV' => 'Impreza III', 'SF' => 'Forester SF', 'SG' => 'Forester SG', 'SH' => 'Forester SH', 'SJ' => 'Forester SJ', 'SK' => 'Forester SK',
            'SL' => 'Forester SL', 'VA' => 'WRX STI (VA)', 'VM' => 'Levorg', 'WX' => 'Tribeca', 'ZC' => 'BRZ',
        ]],
        'Hyundai' => ['at' => [[4, 3], [4, 2]], 'codes' => [
            'A85' => 'i10 II', 'AM5' => 'i10 I', 'B35' => 'i20 II', 'BA5' => 'i20 I', 'BB5' => 'i20 I', 'BM5' => 'i20 III',
            'BM8' => 'Bayon', 'BN5' => 'i20 III', 'BN8' => 'Bayon', 'BR5' => 'i20 III', 'BR8' => 'Bayon', 'BT3' => 'Getz',
            'BT5' => 'Getz', 'BU3' => 'Getz', 'BU5' => [0 => 'Getz', 2020 => 'i20 III'], 'C65' => 'Ioniq', 'C75' => 'Ioniq', 'C85' => 'Ioniq',
            'CG3' => 'Accent II', 'CG4' => 'Accent II', 'CG5' => 'Accent II', 'CM3' => 'Accent III', 'CM4' => 'Accent III', 'CM5' => 'Accent III',
            'CN3' => 'Accent III', 'CN4' => 'Accent III', 'CN5' => 'Accent III', 'CT4' => 'Accent IV', 'CT5' => 'Accent IV', 'D35' => 'i30 II',
            'D38' => 'i30 II', 'D84' => 'Elantra VI (AD)', 'DB5' => 'i30 I', 'DB8' => 'i30 I', 'DC5' => 'i30 I', 'DC8' => 'i30 I',
            'DH4' => 'Elantra V (MD)', 'DN4' => 'Elantra III (XD)', 'DN5' => 'i10 III', 'DR5' => 'i10 III', 'DU4' => 'Elantra IV (HD)', 'EU4' => 'Sonata V (NF)',
            'H35' => 'i30 III', 'H38' => 'i30 III', 'HA8' => 'Kona II', 'HB8' => 'Kona II', 'HC8' => 'Kona II', 'HE8' => 'Kona II',
            'HM6' => 'Coupe (GK)', 'HN6' => 'Coupe (GK)', 'J38' => 'Tucson III', 'JC8' => 'Tucson IV', 'JD8' => 'Tucson IV', 'JE8' => 'Tucson IV',
            'JN8' => 'Tucson I', 'JT8' => 'ix35', 'JU8' => 'ix35', 'K28' => 'Kona I', 'K38' => 'Kona I', 'K58' => 'Kona I',
            'KM8' => 'Ioniq 5', 'KN8' => 'Ioniq 5', 'KR8' => 'Ioniq 5', 'LB4' => 'i40', 'LB8' => 'i40', 'LC4' => 'i40',
            'LC8' => 'i40', 'LD4' => 'i40', 'LD8' => 'i40', 'PM8' => 'Matrix', 'PT8' => 'ix20', 'PU8' => 'ix20',
            'S28' => 'Santa Fe IV', 'S38' => 'Santa Fe IV', 'S48' => 'Santa Fe IV', 'S58' => 'Santa Fe IV', 'SC8' => 'Santa Fe I', 'SH8' => 'Santa Fe II',
            'SW8' => 'Santa Fe III', 'TC6' => 'Veloster', 'A8' => 'i10 II', 'AM' => 'i10 I', 'B2' => 'i20 II', 'B3' => 'i20 II',
            'BA' => 'i20 I', 'BB' => 'i20 I', 'BM' => ['i20 III', 'Bayon'], 'BN' => ['i20 III', 'Bayon'], 'BR' => ['i20 III', 'Bayon'], 'BT' => 'Getz',
            'BU' => [0 => 'Getz', 2020 => ['i20 III', 'Bayon']], 'C6' => 'Ioniq', 'C7' => 'Ioniq', 'C8' => 'Ioniq', 'CG' => 'Accent II', 'CM' => 'Accent III',
            'CN' => 'Accent III', 'CT' => 'Accent IV', 'D3' => 'i30 II', 'D8' => 'Elantra VI (AD)', 'DB' => 'i30 I', 'DC' => 'i30 I',
            'DH' => 'Elantra V (MD)', 'DN' => ['i10 III', 'Elantra III (XD)'], 'DR' => 'i10 III', 'DU' => 'Elantra IV (HD)', 'EU' => 'Sonata V (NF)', 'H3' => 'i30 III',
            'HA' => 'Kona II', 'HB' => 'Kona II', 'HC' => 'Kona II', 'HE' => 'Kona II', 'HM' => 'Coupe (GK)', 'HN' => 'Coupe (GK)',
            'J2' => 'Tucson III', 'J3' => 'Tucson III', 'JB' => 'Tucson IV', 'JC' => 'Tucson IV', 'JD' => 'Tucson IV', 'JE' => 'Tucson IV',
            'JF' => 'Tucson IV', 'JN' => 'Tucson I', 'JT' => 'ix35', 'JU' => 'ix35', 'K1' => 'Kona I', 'K2' => 'Kona I',
            'K3' => 'Kona I', 'K5' => 'Kona I', 'KM' => 'Ioniq 5', 'KN' => 'Ioniq 5', 'KR' => 'Ioniq 5', 'LB' => 'i40',
            'LC' => 'i40', 'LD' => 'i40', 'PM' => 'Matrix', 'PT' => 'ix20', 'PU' => 'ix20', 'S2' => 'Santa Fe IV',
            'S3' => 'Santa Fe IV', 'S4' => 'Santa Fe IV', 'S5' => 'Santa Fe IV', 'SC' => 'Santa Fe I', 'SH' => 'Santa Fe II', 'SW' => 'Santa Fe III',
            'TC' => 'Veloster',
        ]],
        'Kia' => ['at' => [[4, 3], [4, 2]], 'codes' => [
            'B25' => 'Picanto III', 'B35' => 'Picanto III', 'BE5' => 'Picanto I', 'BF5' => 'Picanto I', 'BJ5' => 'Picanto II', 'BX5' => 'Picanto II',
            'C38' => 'EV6', 'C48' => 'EV6', 'CB8' => 'Niro I', 'CC8' => 'Niro I', 'CD8' => 'Niro I', 'CR8' => 'Niro II',
            'D68' => 'Stonic', 'DA8' => 'Stonic', 'DB5' => 'Rio IV', 'DC5' => 'Rio IV', 'DD8' => 'Stonic', 'DN5' => 'Rio III',
            'E35' => 'Stinger', 'E55' => 'Stinger', 'EG8' => 'Venga', 'EH8' => 'Venga', 'GM4' => 'Optima III', 'GN4' => 'Optima III',
            'GT4' => 'Optima IV', 'GU4' => 'Optima IV', 'GU8' => 'Optima IV', 'GV8' => 'Optima IV', 'H25' => 'Ceed III', 'H28' => 'Ceed III',
            'H2F' => 'XCeed', 'H2G' => 'ProCeed', 'H55' => 'Ceed III', 'H58' => 'Ceed III', 'H5F' => 'XCeed', 'H5G' => 'ProCeed',
            'H65' => 'Ceed III', 'H68' => 'Ceed III', 'H6F' => 'XCeed', 'H6G' => 'ProCeed', 'HB3' => 'Ceed I', 'HB5' => 'Ceed I',
            'HB8' => 'Ceed I', 'HM3' => 'Ceed II', 'HM5' => 'Ceed II', 'HM8' => 'Ceed II', 'HN3' => 'Ceed II', 'HN5' => 'Ceed II',
            'HN8' => 'Ceed II', 'HU8' => 'Carens IV', 'J28' => 'e-Soul', 'J38' => 'e-Soul', 'JN8' => 'Soul II', 'JP8' => 'Soul II',
            'JT8' => 'Soul I', 'JX8' => 'Soul II', 'KU8' => 'Sorento II', 'PB8' => 'Sportage III', 'PC8' => 'Sportage III', 'PG8' => 'Sorento III',
            'PH8' => ['Sportage IV', 'Sorento III'], 'PK8' => ['Sportage IV', 'Sorento III'], 'PU8' => 'Sportage V', 'PV8' => 'Sportage V', 'PX8' => 'Sportage V', 'RH8' => 'Sorento IV',
            'RM8' => 'Sorento IV', 'B2' => 'Picanto III', 'B3' => 'Picanto III', 'BE' => 'Picanto I', 'BF' => 'Picanto I', 'BJ' => 'Picanto II',
            'BX' => 'Picanto II', 'C3' => 'EV6', 'C4' => 'EV6', 'CB' => 'Niro I', 'CC' => 'Niro I', 'CD' => 'Niro I',
            'CR' => 'Niro II', 'D6' => 'Stonic', 'DA' => 'Stonic', 'DB' => 'Rio IV', 'DC' => [0 => 'Rio I', 2017 => 'Rio IV'], 'DD' => 'Stonic',
            'DN' => 'Rio III', 'E3' => 'Stinger', 'E5' => 'Stinger', 'EG' => 'Venga', 'EH' => 'Venga', 'GM' => 'Optima III',
            'GN' => 'Optima III', 'GT' => 'Optima IV', 'GU' => 'Optima IV', 'GV' => 'Optima IV', 'H2' => ['Ceed III', 'XCeed', 'ProCeed'], 'H5' => ['Ceed III', 'XCeed', 'ProCeed'],
            'H6' => ['Ceed III', 'XCeed', 'ProCeed'], 'HB' => 'Ceed I', 'HC' => 'Ceed I', 'HM' => 'Ceed II', 'HN' => 'Ceed II', 'HU' => 'Carens IV',
            'J2' => 'e-Soul', 'J3' => 'e-Soul', 'JN' => 'Soul II', 'JP' => 'Soul II', 'JT' => 'Soul I', 'JX' => 'Soul II',
            'KU' => 'Sorento II', 'PB' => 'Sportage III', 'PC' => 'Sportage III', 'PG' => 'Sorento III', 'PH' => ['Sportage IV', 'Sorento III'], 'PK' => ['Sportage IV', 'Sorento III'],
            'PU' => 'Sportage V', 'PV' => 'Sportage V', 'PX' => 'Sportage V', 'RH' => 'Sorento IV', 'RM' => 'Sorento IV',
        ]],
    ];

    /** Kia before ~MY2010: model code at chars 4–5 followed by a two-digit body code (12, 21–24, 52, 55, 7x). */
    private const KIA_OLD = [
        'BA' => 'Picanto I', 'DC' => 'Rio I', 'DE' => 'Rio II', 'DG' => 'Rio II', 'FE' => 'Cerato', 'FF' => 'Ceed I',
        'FG' => 'Carens III', 'FJ' => 'Carens II', 'GD' => 'Magentis I', 'GE' => 'Magentis II', 'JC' => 'Sorento I', 'JD' => 'Sorento I',
        'JE' => 'Sportage II', 'JF' => 'Sportage II', 'MA' => 'Carnival I', 'MB' => 'Carnival II', 'MG' => 'Carnival II', 'MH' => 'Carnival II',
    ];

    /** BMW type codes with a letter at char 5: the model family at chars 4–5 (one family = one chassis). */
    private const BMW_OLD = [
        '1A' => '1 (F20)', '1B' => '1 (F20)', '1C' => '1 (F20)', '1E' => '1 (F20)', '1F' => '2 Coupé (F22)', '1G' => '2 Coupé (F22)',
        '1H' => '2 Coupé (F22)', '1J' => '2 Coupé (F22)', '1M' => '2 Coupé (F22)', '1N' => '1 (F20)', '1P' => '1 (F20)', '1R' => '1 (F20)',
        '1S' => '1 (F20)', '1T' => '1 (F20)', '1U' => '1 (F20)', '1V' => '1 (F20)', '1W' => '1 (F20)', '1X' => '1 (F20)',
        '1Y' => '1 (F20)', '1Z' => 'i3', '2B' => ['2 Active Tourer (F45)', '2 Gran Tourer (F46)'], '2C' => '2 Active Tourer (F45)', '2E' => '2 Gran Tourer (F46)', '2F' => '2 Coupé (F22)',
        '2G' => '2 Coupé (F22)', '2H' => '2 Coupé (F22)', '2J' => '2 Coupé (F22)', '2L' => '2 Coupé (F22)', '2P' => '1 (F20)', '2R' => '1 (F20)',
        '2S' => '1 (F20)', '2V' => 'X4 (G02)', '3A' => '3 (F30)', '3B' => '3 (F30)', '3C' => '3 (F30)', '3D' => '3 (F30)',
        '3E' => '3 (F30)', '3F' => '3 (F30)', '3J' => '3 (F30)', '3K' => '3 (F30)', '3L' => '3 (F30)', '3N' => '4 (F32)',
        '3P' => '4 (F32)', '3S' => '4 (F32)', '3U' => '4 (F32)', '3W' => '3 (F30)', '3X' => '3 (F30)', '3Y' => '3 (F30)',
        '3Z' => '3 (F30)', '4A' => '4 (F32)', '4B' => '4 (F32)', '4C' => '4 (F32)', '4D' => '4 (F32)', '4E' => '4 (F32)',
        '4F' => '4 (F32)', '4G' => '4 (F32)', '4J' => '4 (F32)', '4P' => '4 (F32)', '4R' => '4 (F32)', '4T' => '4 (F32)',
        '4W' => '4 (F32)', '5A' => '5 (F10)', '5B' => '5 (F10)', '5C' => '5 (F10)', '5D' => '5 (F10)', '5E' => '5 (F10)',
        '5F' => '3 (G20)', '5M' => '5 GT (F07)', '5N' => '5 GT (F07)', '5P' => '3 (G20)', '5R' => '3 (G20)', '5U' => '3 (G20)',
        '6T' => '2 Active Tourer (F45)', '6X' => '2 Active Tourer (F45)', '6Y' => '2 Active Tourer (F45)', '7M' => '1 (F40)', '7Z' => 'i3', '8A' => '3 (F30)',
        '8B' => '3 (F30)', '8C' => '3 (F30)', '8D' => '3 (F30)', '8E' => '3 (F30)', '8F' => '3 (F30)', '8G' => '3 (F30)',
        '8H' => '3 (F30)', '8J' => '3 (F30)', '8K' => '3 (F30)', '8L' => '3 (F30)', '8Y' => '3 (F30)', '8Z' => '3 (F30)',
        'AL' => '3 (E46)', 'AN' => '3 (E46)', 'AP' => '3 (E46)', 'AR' => '3 (E46)', 'AT' => '3 (E46)', 'AU' => '3 (E46)',
        'AW' => '3 (E46)', 'AX' => '3 (E46)', 'AY' => '3 (E46)', 'AZ' => '3 (E46)', 'BD' => '3 (E46)', 'BE' => '3 (E36)',
        'BF' => '3 (E36)', 'BG' => '3 (E36)', 'BH' => '3 (E36)', 'BJ' => '3 (E36)', 'BK' => '3 (E36)', 'BL' => '3 (E46)',
        'BM' => '3 (E46)', 'BN' => '3 (E46)', 'BP' => '3 (E46)', 'BR' => '3 (E46)', 'BS' => '3 (E46)', 'BV' => '3 (E46)',
        'BW' => '3 (E46)', 'BX' => '3 (E46)', 'BY' => '3 (E46)', 'BZ' => 'Z4 (E85)', 'CA' => '3 (E36)', 'CB' => '3 (E36)',
        'CC' => '3 (E36)', 'CD' => '3 (E36)', 'CE' => '3 (E36)', 'CF' => '3 (E36)', 'CG' => '3 (E36)', 'CH' => '3 (E36)',
        'CJ' => '3 (E36)', 'CP' => '3 (E36)', 'CR' => 'X5 (G05)', 'CS' => '3 (E36)', 'CT' => '3 (E36)', 'CV' => 'X5 (G05)',
        'CY' => 'X6 (G06)', 'DD' => '5 (E39)', 'DM' => '5 (E39)', 'DN' => '5 (E39)', 'DT' => '5 (E39)', 'DV' => '3 (E90)',
        'DW' => '3 (E90)', 'DX' => '3 (E90)', 'DY' => '3 (E90)', 'EA' => '6 (E63)', 'EB' => '6 (E63)', 'ED' => '3 (E46)',
        'EH' => '6 (E63)', 'EJ' => '3 (E46)', 'EK' => '6 (E63)', 'EL' => '3 (E46)', 'EN' => '3 (E46)', 'ER' => '3 (E46)',
        'ET' => '3 (E46)', 'EX' => '3 (E46)', 'EY' => '3 (E46)', 'EZ' => '3 (E46)', 'FA' => 'X5 (E53)', 'FB' => 'X5 (E53)',
        'FF' => 'X5 (E70)', 'FG' => 'X6 (E71)', 'FH' => 'X6 (E71)', 'FR' => '5 (F10)', 'FU' => '5 (F10)', 'FV' => '5 (F10)',
        'FW' => '5 (F10)', 'GL' => '7 (E65)', 'GM' => '7 (E65)', 'GN' => '7 (E65)', 'GT' => 'X6 (G06)', 'HB' => '5 (E34)',
        'HE' => '5 (E34)', 'HL' => '7 (E65)', 'HM' => '7 (E65)', 'HN' => '7 (E65)', 'HT' => 'X1 (F48)', 'HU' => 'X1 (F48)',
        'JA' => '5 (G30)', 'JB' => '5 (G30)', 'JC' => '5 (G30)', 'JD' => '5 (G30)', 'JE' => '5 (G30)', 'JG' => 'X1 (F48)',
        'JS' => '5 (G30)', 'JU' => 'X5 (G05)', 'KD' => '3 (E90)', 'KE' => '3 (E90)', 'KF' => '3 (E90)', 'KG' => '3 (E90)',
        'KH' => '3 (E90)', 'KK' => '3 (E90)', 'KR' => 'X5 (F15)', 'KS' => 'X5 (F15)', 'KT' => 'X5 (F15)', 'KU' => 'X6 (F16)',
        'LS' => 'X5 (F15)', 'MX' => '5 (F10)', 'NB' => '5 (E60)', 'NC' => '5 (E60)', 'ND' => '5 (E60)', 'NE' => '5 (E60)',
        'NF' => '5 (E60)', 'NJ' => '5 (E60)', 'NK' => '5 (E60)', 'NL' => '5 (E60)', 'NM' => '5 (E60)', 'NN' => '5 (E60)',
        'NP' => '5 (E60)', 'NR' => '5 (E60)', 'NS' => '5 (E60)', 'NT' => '5 (E60)', 'NU' => '5 (E60)', 'NV' => '5 (E60)',
        'NX' => '5 (E60)', 'NY' => '5 (E60)', 'PA' => 'X3 (E83)', 'PB' => 'X3 (E83)', 'PC' => 'X3 (E83)', 'PD' => 'X3 (E83)',
        'PE' => 'X3 (E83)', 'PF' => '3 (E90)', 'PG' => '3 (E90)', 'PH' => '3 (E90)', 'PK' => '3 (E90)', 'PL' => '3 (E90)',
        'PM' => '3 (E90)', 'PN' => '3 (E90)', 'PP' => '3 (E90)', 'PR' => '3 (E90)', 'PT' => '5 (E60)', 'PU' => '5 (E60)',
        'PV' => '5 (E60)', 'PX' => '5 (E60)', 'PY' => '5 (E60)', 'SN' => '5 GT (F07)', 'SP' => '5 GT (F07)', 'TR' => 'X3 (G01)',
        'TS' => 'X3 (G01)', 'TX' => 'X3 (G01)', 'TY' => 'X3 (G01)', 'UA' => '1 (E87)', 'UB' => '1 (E87)', 'UC' => '1 (E87)',
        'UD' => '1 (E87)', 'UE' => '1 (E87)', 'UF' => '1 (E87)', 'UG' => '1 (E87)', 'UH' => '1 (E87)', 'UJ' => 'X4 (G02)',
        'UK' => '1 (E87)', 'UL' => '1 (E87)', 'UM' => '1 (E87)', 'UN' => '1 (E87)', 'UP' => '1 (E87)', 'UR' => '1 (E87)',
        'US' => '3 (E90)', 'UT' => '3 (E90)', 'UU' => '3 (E90)', 'UV' => '3 (E90)', 'UX' => '3 (E90)', 'UY' => '3 (E90)',
        'VA' => '3 (E90)', 'VB' => '3 (E90)', 'VC' => '3 (E90)', 'VD' => '3 (E90)', 'VE' => '3 (E90)', 'VF' => '3 (E90)',
        'VG' => '3 (E90)', 'VL' => 'X1 (E84)', 'VM' => 'X1 (E84)', 'VP' => 'X1 (E84)', 'VR' => '3 (E90)', 'VS' => '3 (E90)',
        'VT' => '3 (E90)', 'VU' => '3 (E90)', 'VV' => '3 (E90)', 'VW' => '3 (E90)', 'VY' => '3 (E90)', 'WA' => '3 (E90)',
        'WB' => '3 (E90)', 'WC' => '3 (E90)', 'WD' => '3 (E90)', 'WE' => '3 (E90)', 'WK' => '3 (E90)', 'WL' => '3 (E90)',
        'WM' => '3 (E90)', 'WN' => '3 (E90)', 'WR' => '3 (E90)', 'WX' => 'X3 (F25)', 'WY' => 'X3 (F25)', 'WZ' => 'X3 (F25)',
        'XA' => '5 (F10)', 'XC' => '5 GT (F07)', 'XG' => '5 (F10)', 'XH' => '5 (F10)', 'XW' => 'X4 (F26)', 'XX' => 'X4 (F26)',
        'YH' => 'X2 (F39)', 'YJ' => 'X2 (F39)', 'YK' => 'X2 (F39)', 'ZV' => 'X5 (E70)', 'ZW' => 'X5 (E70)',
    ];

    /** BMW type codes from ~2019 (two digits at chars 4–5): the family moved to chars 6–7. */
    private const BMW_NEW = [
        'AB' => 'X1 (F48)', 'AK' => '2 Gran Coupé (F44)', 'AP' => '4 (G22)', 'AR' => '4 (G22)', 'AV' => '4 (G22)', 'AW' => 'i4 (G26)',
        'BJ' => '5 (G30)', 'BX' => '2 Active Tourer (U06)', 'BY' => '2 Coupé (G42)', 'BZ' => 'X3 (G01)', 'CA' => 'X4 (G02)', 'CM' => '2 Coupé (G42)',
        'DP' => 'X3 (G01)', 'DT' => 'X4 (G02)', 'DZ' => '3 (G20)', 'EF' => 'X1 (U11)', 'EG' => 'X1 (U11)', 'EU' => 'X5 (G05)',
        'EV' => 'X5 (G05)', 'EY' => 'X6 (G06)', 'FB' => 'i4 (G26)', 'FF' => '3 (G20)', 'FK' => '5 (G60)', 'FL' => '5 (G60)',
        'FS' => '3 (G20)', 'GL' => '3 (G20)', 'GM' => 'X2 (U10)', 'GN' => 'X2 (U10)', 'GR' => 'X3 (G45)', 'HD' => 'i4 (G26)',
    ];

    /** Mini, classic type codes: family at chars 4–5. */
    private const MINI_OLD = [
        'LN' => 'Clubman (F54)', 'LR' => 'Clubman (F54)', 'LU' => 'Clubman (F54)', 'LV' => 'Clubman (F54)', 'ME' => 'Cooper (R56)', 'MF' => 'Cooper (R56)',
        'MG' => 'Cooper (R56)', 'MN' => 'Clubman (R55)', 'MS' => 'Cooper (R56)', 'RC' => 'Cooper (R50/R53)', 'RD' => 'Cooper (R50/R53)', 'RE' => 'Cooper (R50/R53)',
        'RF' => 'Cooper (R50/R53)', 'RH' => 'Cooper (R50/R53)', 'RJ' => 'Paceman (R61)', 'RS' => 'Paceman (R61)', 'SR' => 'Cooper (R56)', 'SS' => 'Paceman (R61)',
        'SU' => 'Cooper (R56)', 'SV' => 'Cooper (R56)', 'SW' => 'Cooper (R56)', 'SX' => 'Coupé/Roadster (R58/R59)', 'SY' => 'Coupé/Roadster (R58/R59)', 'WG' => 'Cooper (F56)',
        'XD' => 'Countryman (R60)', 'XE' => 'Clubman (R55)', 'XF' => 'Cooper (R56)', 'XJ' => 'Clubman (F54)', 'XM' => 'Cooper (F56)', 'XP' => 'Cooper (F56)',
        'XR' => 'Cooper (F56)', 'XS' => 'Cooper (F56)', 'XU' => 'Cooper (F56)', 'YT' => 'Countryman (F60)', 'YU' => 'Countryman (F60)', 'YV' => 'Countryman (F60)',
        'ZB' => 'Countryman (R60)', 'ZC' => 'Countryman (R60)', 'ZD' => 'Countryman (R60)', 'ZF' => 'Clubman (R55)', 'ZH' => 'Clubman (R55)', 'ZP' => 'Cooper (R56)',
        'ZR' => 'Cooper (R56)',
    ];

    /** Mini, new type codes (two digits at chars 4–5): family at chars 6–7. */
    private const MINI_NEW = [
        'DH' => 'Cooper (F56)', 'DK' => 'Cooper (F56)', 'DL' => 'Cooper (F56)', 'GA' => 'Countryman (U25)',
    ];

    /** Volvo for North America from MY2010 (and WMI 7JR): the series letter at char 7. */
    private const VOLVO_US = [
        '0' => 'XC90 II', '1' => 'XC90 II', 'A' => 'S90 II', 'C' => 'XC90 II', 'D' => 'XC60 II', 'E' => 'V60 II',
        'F' => 'S60 III', 'G' => 'EC40 (C40 Recharge)', 'H' => 'XC40', 'K' => 'XC90 II', 'M' => 'S90 II', 'N' => 'V90 Cross Country',
        'P' => 'XC90 II', 'R' => 'XC60 II', 'S' => 'V60 II', 'T' => 'S60 III', 'U' => 'XC40', 'W' => 'V60 Cross Country II',
    ];

    /** Opel, GM scheme to ~2009: "0" + model/body code at chars 4–7. */
    private const OPEL_OLD = [
        '0AHL' => 'Astra H', '0AHM' => 'Zafira B', '0HAF' => 'Agila A', '0JBF' => 'Vectra B', '0MFF' => 'Astra F', '0SDL' => 'Corsa D',
        '0TGF' => ['Astra G', 'Zafira A'], '0VBF' => 'Omega B', '0VBM' => 'Omega B', '0XCE' => 'Meriva A', '0XCF' => [0 => ['Corsa C', 'Combo C'], 2007 => 'Combo C'], '0XEP' => 'Corsa E',
    ];

    /** Opel from 2009 (incl. Renault- and PSA-built models): line + series + body at chars 4–6, then chars 4–5. */
    private const OPEL_NEW = [
        '1J7' => 'Vivaro B', '3F7' => 'Vivaro B', '6VZ' => 'Combo D', 'F7A' => 'Vivaro A', 'F7G' => 'Vivaro B', 'J7A' => 'Vivaro A',
        'J7B' => 'Vivaro A', 'J7D' => 'Vivaro B', 'J7E' => 'Vivaro B', 'J7H' => 'Vivaro B', 'PC9' => 'Zafira C Tourer', 'PD9' => 'Zafira C Tourer',
        'PE9' => 'Zafira C Tourer', '7D' => 'Crossland', '7H' => 'Crossland', 'BD' => 'Astra K', 'BE' => 'Astra K', 'BF' => 'Astra K',
        'EF' => 'Combo E', 'EH' => 'Combo E', 'ER' => 'Combo E', 'EZ' => 'Combo E', 'F3' => 'Astra L', 'FP' => 'Astra L',
        'GM' => 'Insignia A', 'GS' => 'Insignia A', 'GT' => 'Insignia A', 'GX' => 'Insignia A', 'JC' => 'Mokka', 'JD' => 'Mokka',
        'MR' => 'Movano B', 'MS' => 'Movano B', 'MV' => 'Movano B', 'MW' => 'Movano B', 'PD' => 'Astra J', 'SH' => 'Meriva B',
        'UK' => 'Mokka B', 'UP' => 'Corsa F', 'US' => 'Mokka B', 'VR' => 'Movano B', 'VS' => 'Movano B', 'VU' => 'Movano B',
        'ZC' => 'Grandland', 'ZM' => 'Insignia B', 'ZR' => 'Grandland', 'ZT' => 'Insignia B',
    ];

    /** Opel vans built by Stellantis (WMI VXE): chars 4–5, then char 4. */
    private const OPEL_VXE = [
        'VE' => ['Vivaro C', 'Zafira Life'], 'VZ' => ['Vivaro C', 'Zafira Life'], 'V' => 'Vivaro C', 'Y' => 'Movano C',
    ];

    /** Jeep, FCA US (WMI 1C4): line + series at chars 4–6. */
    private const JEEP_1C4 = [
        'BU0' => 'Renegade', 'PJL' => 'Cherokee KL', 'PJM' => 'Cherokee KL', 'PJX' => 'Wrangler JL', 'RJE' => 'Grand Cherokee WK2', 'RJF' => 'Grand Cherokee WK2',
        'RJH' => 'Grand Cherokee WL',
    ];

    /** Jeep before 2011 (WMI 1J4): chars 4–5. */
    private const JEEP_1J4 = [
        'FJ' => 'Cherokee XJ', 'GR' => 'Grand Cherokee WK',
    ];

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
        $year = self::year($make, $wmi, $vin);

        $models = [];
        $candidates = $make === null || in_array($wmi, self::MAKE_ONLY_WMIS, true) ? [] : self::candidates($make, $wmi, $vin, $year);
        foreach ($candidates as $name) {
            // "Make:Model" — the VIN belongs to another make than its WMI says.
            if (preg_match('/^([^:]+):(.+)$/u', $name, $m) && in_array($m[1], self::PREFIX_MAKES, true)) {
                $make = $m[1];
                $name = $m[2];
            }
            $models[] = $name;
        }

        return ['valid' => true, 'make' => $make, 'year' => $year, 'models' => array_values(array_unique($models))];
    }

    private static function year(?string $make, string $wmi, string $vin): ?int
    {
        return match (true) {
            $make === null => null,
            in_array($wmi, self::MAKE_ONLY_WMIS, true) => self::modelYear($vin[9]),
            $make === 'Ford' => in_array($wmi, self::FORD_EU_WMIS, true) ? self::modelYear($vin[10]) : null,
            $make === 'Mazda' => in_array($wmi, self::MAZDA_YEAR_WMIS, true) ? self::modelYear($vin[9]) : null,
            in_array($make, self::PSA_MAKES, true) => ctype_alpha($vin[9]) || (in_array($vin[9], ['8', '9'], true) && ctype_alpha($vin[10])) ? self::modelYear($vin[9]) : null,
            in_array($make, self::LETTER_YEAR_MAKES, true) => ctype_alpha($vin[9]) ? self::modelYear($vin[9]) : null,
            // Movano C (built on the Ducato) carries a constant "1" there.
            $wmi === 'VXE' && $vin[3] === 'Y' => null,
            in_array($make, self::MODEL_YEAR_MAKES, true) => self::modelYear($vin[9]),
            default => null,
        };
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
    private static function candidates(string $make, string $wmi, string $vin, ?int $year): array
    {
        $entry = self::special($make, $wmi, $vin) ?? self::lookup($make, $vin) ?? self::fallback($make, $vin, $year);

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
            return array_values(array_unique(array_merge(...array_map(fn ($v) => (array) $v, array_values($entry)))));
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

    /** The maker's table(s), trying each window of each scheme in order; the first hit wins. */
    private static function lookup(string $make, string $vin): string|array|null
    {
        $scheme = self::SCHEMES[$make] ?? null;
        if ($scheme === null) {
            return null;
        }
        foreach (array_is_list($scheme) ? $scheme : [$scheme] as $part) {
            foreach ($part['at'] as [$start, $length]) {
                $code = substr($vin, $start - 1, $length);
                if (isset($part['codes'][$code])) {
                    return $part['codes'][$code];
                }
            }
        }

        return null;
    }

    /** Volvo for North America swaps the codes from MY2010: an unknown European code then means the series letter at char 7. */
    private static function fallback(string $make, string $vin, ?int $year): string|array|null
    {
        return $make === 'Volvo' && $year !== null && $year >= 2010 ? (self::VOLVO_US[$vin[6]] ?? null) : null;
    }

    /** Makers whose model needs more than a table: the WMI, a plant or a body letter decides. Null = use the table. */
    private static function special(string $make, string $wmi, string $vin): string|array|null
    {
        return match ($make) {
            // 247 is the B-Class on W1K/WDD and the GLA on W1N/WDC.
            'Mercedes-Benz' => substr($vin, 3, 3) === '247' ? (in_array($wmi, ['W1N', 'WDC'], true) ? 'GLA (H247)' : 'B (W247)') : null,
            'Jaguar' => self::jaguar($wmi, $vin[3]),
            'BMW' => self::bmwFamily($vin, self::BMW_OLD, self::BMW_NEW),
            'Mini' => self::bmwFamily($vin, self::MINI_OLD, self::MINI_NEW),
            'Ford' => self::ford($vin),
            'Volvo' => $wmi === '7JR' ? (self::VOLVO_US[$vin[6]] ?? null) : null,
            // Toyota Motor Europe's YAR also carries the PSA-built vans.
            'Toyota' => $wmi === 'YAR' ? match ($vin[3]) {
                'V' => 'Proace II', 'E' => 'Proace City', default => null,
            } : null,
            // CT and UX share series B + line H; the 5-door hatch body letter is the CT.
            'Lexus' => substr($vin, 6, 2) === 'BH' ? ($vin[3] === 'K' ? 'CT' : 'UX') : null,
            // Esztergom built the Fiat Sedici next to the SX4.
            'Suzuki' => $wmi === 'TSM' && substr($vin, 3, 2) === 'FY' ? 'Fiat:Sedici' : null,
            // Subaru of Indiana "BT" is the US-only Baja, not an Outback.
            'Subaru' => $wmi === '4S4' && substr($vin, 3, 2) === 'BT' ? [] : null,
            'Opel' => self::opel($wmi, $vin),
            'Jeep' => self::jeep($wmi, $vin),
            'Fiat' => match (substr($vin, 3, 3)) {
                // Kragujevac (char 11 "5") builds the 500L on the Punto's type code, Pomigliano ("3") the Panda III on the 500's.
                '199' => $vin[10] === '5' ? '500L' : 'Punto III (Grande/Evo)',
                '312' => $vin[10] === '3' ? 'Panda III' : '500',
                default => null,
            },
            // 208 II and 2008 II share "U": Vigo builds the 2008, Trnava and Kenitra the 208.
            'Peugeot' => $vin[3] === 'U' ? match ($vin[10]) {
                'J' => '2008 II', 'T', '5' => '208 II', default => ['208 II', '2008 II'],
            } : null,
            'Hyundai' => self::hyundai($wmi, $vin),
            'Kia' => self::kia($wmi, $vin),
            default => null,
        };
    }

    /** BMW and Mini: newer type codes have two digits at chars 4–5 and the family at 6–7, classic ones the family at 4–5. */
    private static function bmwFamily(string $vin, array $classic, array $newer): string|array|null
    {
        return ctype_digit($vin[4]) ? ($newer[substr($vin, 5, 2)] ?? null) : ($classic[substr($vin, 3, 2)] ?? null);
    }

    /** Ford of Europe: chars 7–9 = source + plant + model letter; the body letter (char 4) splits models built side by side. */
    private static function ford(string $vin): string|array|null
    {
        $body = $vin[3];

        return match (substr($vin, 6, 3)) {
            'WPC' => match (true) {
                in_array($body, ['F', 'D', 'N', 'S'], true) => 'Mondeo V',
                $body === 'J' => 'S-Max II',
                $body === 'K' => 'Galaxy III',
                default => null,
            },
            'TTG' => match (true) {
                in_array($body, ['Y', 'Z'], true) => [0 => ['Transit Custom', 'Tourneo Custom'], 2023 => ['Transit Custom II', 'Tourneo Custom II']],
                in_array($body, ['X', '3', '5'], true) => 'Transit',
                default => null,
            },
            default => null,
        };
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

    /** Opel: Stellantis vans (VXE), the GM scheme to ~2009 ("0" + code) and the 2009+ scheme, each with its own table. */
    private static function opel(string $wmi, string $vin): string|array|null
    {
        if ($wmi === 'VXE') {
            return self::OPEL_VXE[substr($vin, 3, 2)] ?? self::OPEL_VXE[$vin[3]] ?? null;
        }
        if ($vin[3] === '0') {
            $code = substr($vin, 3, 4);

            // Astra G and Zafira A share 0TGF: the MPV body has "7" at char 8.
            return $code === '0TGF' ? ($vin[7] === '7' ? 'Zafira A' : 'Astra G') : (self::OPEL_OLD[$code] ?? null);
        }

        return self::OPEL_NEW[substr($vin, 3, 3)] ?? self::OPEL_NEW[substr($vin, 3, 2)] ?? match ($vin[3]) {
            // Delta II: body digit 9 is the Zafira Tourer, anything else the Astra J.
            'P' => $vin[5] === '9' ? 'Zafira C Tourer' : 'Astra J',
            // "Z": the Insignia B has a digit body code at char 6, the PSA-built Grandland an engine letter.
            'Z' => ctype_digit($vin[5]) ? 'Insignia B' : 'Grandland',
            default => null,
        };
    }

    /** Jeep: the FCA WMIs are shared, so the WMI picks the table (and sometimes the make). */
    private static function jeep(string $wmi, string $vin): string|array|null
    {
        return match ($wmi) {
            '1C4' => substr($vin, 3, 2) === 'RD' ? 'Dodge:Durango III' : (self::JEEP_1C4[substr($vin, 3, 3)] ?? null),
            '1J4' => self::JEEP_1J4[substr($vin, 3, 2)] ?? null,
            '3C4' => substr($vin, 3, 2) === 'PF' ? 'Fiat:Freemont' : null,
            // ZAC (Melfi): "NJ" is the Compass on EU cars but the Renegade on US ones – make and year only.
            default => null,
        };
    }

    /** Hyundai rules on top of the table: shared WMIs and line letters that were reused across eras. */
    private static function hyundai(string $wmi, string $vin): string|array|null
    {
        $line = substr($vin, 3, 2);

        return match (true) {
            // Kia Venga was built at Hyundai's Nošovice plant under the TMA WMI.
            $wmi === 'TMA' && in_array($line, ['EG', 'EH'], true) => 'Kia:Venga',
            // KMF = light commercial vehicles: in practice the H-1 van.
            $wmi === 'KMF' => [0 => 'H-1 I', 2008 => 'H-1 II'],
            // "DN" is the i10 III from İzmit (NLH) but the Elantra XD from Korea (KMH).
            $line === 'DN' && $wmi === 'KMH' => 'Elantra III (XD)',
            $line === 'DN' && $wmi === 'NLH' => 'i10 III',
            default => null,
        };
    }

    /** Kia: the pre-2010 scheme, Hyundai ix35 from Žilina and the Sportage IV / Sorento III code they share. */
    private static function kia(string $wmi, string $vin): string|array|null
    {
        $line = substr($vin, 3, 2);

        // Before ~MY2010 the model code is followed by a two-digit body code; the new scheme has a body digit and a restraint code there.
        if (preg_match('/^(12|2[1-4]|5[25]|7\d)$/', substr($vin, 5, 2))) {
            return self::KIA_OLD[$line] ?? null;
        }
        // Kia Slovakia (Žilina) also assembled the Hyundai ix35.
        if ($wmi === 'U5Y' && in_array($line, ['JU', 'JT'], true)) {
            return 'Hyundai:ix35';
        }
        // PH/PK are shared by the Sportage QL and the Sorento UM: Žilina only builds the Sportage, on KNA the plant (char 11) decides.
        if (in_array($line, ['PH', 'PK'], true)) {
            return match (true) {
                $wmi === 'U5Y' => 'Sportage IV',
                $wmi === 'KNA' && in_array($vin[10], ['5', 'A'], true) => 'Sorento III',
                $wmi === 'KNA' && $vin[10] === '7' => 'Sportage IV',
                default => ['Sportage IV', 'Sorento III'],
            };
        }

        return null;
    }
}
