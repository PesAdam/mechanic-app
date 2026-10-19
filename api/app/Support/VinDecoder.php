<?php

namespace App\Support;

/**
 * Offline VIN decoder. Standard part: manufacturer (WMI, chars 1–3). Maker-specific
 * part: model year (char 10, only for makers that encode it) and the model /
 * generation, which lives in the VDS (chars 4–9) in each maker's own scheme.
 *
 * Every maker is a SCHEMES entry: the character windows to try (1-based start, length)
 * and the code table; a few makers need a rule on top (special()). A name may carry a
 * "Make:" prefix when the VIN belongs to another make than its WMI says (Cupra on Seat's
 * WMI, a Kia Venga built by Hyundai in Nošovice). Everything else gets make (+ year where
 * encoded); the model is a hint, never gospel.
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
        'KMH' => 'Hyundai', 'TMA' => 'Hyundai', 'NLH' => 'Hyundai', 'MAL' => 'Hyundai', 'KMF' => 'Hyundai',
        'KM8' => 'Hyundai', '5NP' => 'Hyundai', '5NM' => 'Hyundai',
        'KNA' => 'Kia', 'KNE' => 'Kia', 'U5Y' => 'Kia', 'U6Y' => 'Kia', 'KND' => 'Kia', '5XY' => 'Kia', '5XX' => 'Kia', '3KP' => 'Kia',
        'VSS' => 'Seat',
        'ZFA' => 'Fiat', 'ZFC' => 'Fiat',
        'SHH' => 'Honda', 'JHM' => 'Honda', 'NLA' => 'Honda',
        'JMZ' => 'Mazda', 'JM1' => 'Mazda',
        'SJN' => 'Nissan', 'VSK' => 'Nissan', 'JN1' => 'Nissan',
        'JNK' => 'Infiniti', 'JNR' => 'Infiniti', 'SJK' => 'Infiniti',
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
    private const MODEL_YEAR_MAKES = ['Škoda', 'Volkswagen', 'Audi', 'Seat', 'Cupra', 'Opel', 'Hyundai', 'Kia', 'Honda', 'Volvo', 'Subaru', 'Jeep', 'Land Rover', 'Porsche', 'Jaguar', 'Tesla', 'Infiniti'];

    /** North-American builds of European-sold makes: the make is certain, but their VDS does not follow the EU tables. */
    private const MAKE_ONLY_WMIS = ['KM8', '5NP', '5NM', 'KND', '5XY', '5XX', '3KP'];

    private const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';

    /**
     * Per maker: the VDS windows to try in order ([1-based start, length]) and the code table, or a
     * list of such schemes (e.g. one per era, each with its own windows) tried in order.
     * Table value = name | [candidates…] | [fromYear => name | [candidates…]] (year split: the
     * generation current for the model year). A "Make:" prefix moves the car to that make
     * (Cupra shares Seat's WMI).
     *
     * @var array<string, array{at: list<array{0: int, 1: int}>, codes: array<string, mixed>}|list<array{at: list<array{0: int, 1: int}>, codes: array<string, mixed>}>>
     */
    private const SCHEMES = [
        'Škoda' => ['at' => [[7, 2]], 'codes' => [
            '6U' => 'Felicia', '1U' => 'Octavia I', '1Z' => 'Octavia II', 'NE' => 'Octavia III', 'NX' => 'Octavia IV',
            '6Y' => 'Fabia I', '5J' => ['Fabia II', 'Roomster', 'Praktik'], 'NJ' => 'Fabia III', 'PJ' => 'Fabia IV',
            '3U' => 'Superb I', '3T' => 'Superb II', '3V' => 'Superb III', '3Y' => 'Superb IV',
            '5L' => 'Yeti', 'NS' => [0 => 'Kodiaq I', 2024 => 'Kodiaq II'], 'NU' => 'Karoq', 'NH' => 'Rapid',
            'NW' => ['Scala', 'Kamiq'], 'NY' => 'Enyaq', 'AA' => 'Citigo',
        ]],
        'Volkswagen' => ['at' => [[7, 2]], 'codes' => [
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
        ]],
        'Audi' => ['at' => [[7, 2]], 'codes' => [
            '8C' => '80 (B4)', '8X' => 'A1 (8X)', 'GB' => 'A1 (GB)', '8Z' => 'A2', '8L' => 'A3 (8L)', '8P' => 'A3 (8P)', '8V' => 'A3 (8V)', '8Y' => 'A3 (8Y)',
            '8D' => 'A4 (B5)', '8E' => [0 => 'A4 (B6)', 2005 => 'A4 (B7)'], '8H' => 'A4 (B6)', '8K' => 'A4 (B8)', '8W' => 'A4 (B9)', '8T' => 'A5 (8T)', '8F' => 'A5 (8T)', 'F5' => 'A5 (F5)',
            '4A' => 'A6 (C4)', '4B' => 'A6 (C5)', '4F' => 'A6 (C6)', '4G' => ['A6 (C7)', 'A7 (4G)'], '4K' => ['A6 (C8)', 'A7 (4K)'],
            '4E' => 'A8 (D3)', '4H' => 'A8 (D4)', '4N' => 'A8 (D5)', '8N' => 'TT (8N)', '8J' => 'TT (8J)', 'FV' => 'TT (8S)',
            'GA' => 'Q2', '8U' => 'Q3 (8U)', 'F3' => 'Q3 (F3)', 'F4' => 'Q4 e-tron', '8R' => 'Q5 (8R)', 'FY' => 'Q5 (FY)', '4L' => 'Q7 (4L)', '4M' => ['Q7 (4M)', 'Q8'], 'GE' => ['e-tron', 'Q8 e-tron'],
        ]],
        'Seat' => ['at' => [[7, 2]], 'codes' => [
            '6J' => 'Ibiza IV', 'KJ' => ['Ibiza V', 'Arona'], '1P' => 'Leon II', '5F' => 'Leon III', 'KL' => ['Leon IV', 'Cupra:Leon'],
            'NH' => 'Toledo IV', 'KH' => ['Ateca', 'Cupra:Ateca'], '7N' => 'Alhambra II', 'KM' => 'Cupra:Formentor', 'K1' => 'Cupra:Born',
        ]],
        // Mercedes: series (Baureihe) at chars 4–6; 247 is decided by the WMI in special().
        'Mercedes-Benz' => ['at' => [[4, 3]], 'codes' => [
            '169' => 'A (W169)', '176' => 'A (W176)', '177' => 'A (W177)', '245' => 'B (W245)', '246' => 'B (W246)',
            '203' => 'C (W203)', '204' => 'C (W204)', '205' => 'C (W205)', '206' => 'C (W206)',
            '211' => 'E (W211)', '212' => 'E (W212)', '213' => 'E (W213)', '117' => 'CLA (C117)', '118' => 'CLA (C118)',
            '156' => 'GLA (X156)', '253' => 'GLC (X253)', '254' => 'GLC (X254)', '164' => 'ML (W164)', '166' => 'ML/GLE (W166)', '167' => 'GLE (V167)',
            '639' => 'Vito (W639)', '447' => 'Vito (W447)', '906' => 'Sprinter (W906)', '907' => 'Sprinter (W907)', '910' => 'Sprinter (W907)',
        ]],
        // Renault: model code at chars 4–6 (newer) or 4–5.
        'Renault' => ['at' => [[4, 3], [4, 2]], 'codes' => [
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
        ]],
        'Dacia' => ['at' => [[4, 3]], 'codes' => [
            'LSD' => ['Logan I', 'Logan II'], 'KSD' => 'Logan MCV I', 'BSD' => 'Sandero I', '5SD' => 'Sandero II',
            'HSD' => 'Duster I', 'HJD' => 'Duster II', 'JSD' => 'Lodgy',
        ]],
        // PSA: model family letter at char 4.
        'Peugeot' => ['at' => [[4, 1]], 'codes' => [
            '2' => '206', 'W' => '207', 'C' => '208 I', 'U' => '208 II', '3' => '307', '4' => '308 I', 'L' => ['308 II', '308 III'],
            '0' => '3008 I', 'M' => ['3008 II', '5008 II'], '8' => '508 I', 'F' => '508 II', 'G' => 'Partner', 'Y' => 'Boxer',
        ]],
        'Citroën' => ['at' => [[4, 1]], 'codes' => [
            'S' => ['C3 II', 'C3 III'], 'L' => 'C4 I', 'N' => 'C4 II', 'R' => 'C5 II', 'G' => ['Berlingo II', 'Berlingo III'], 'V' => 'Jumpy III', 'Y' => 'Jumper',
        ]],
        // Fiat / Alfa: type code at chars 4–6.
        'Fiat' => ['at' => [[4, 3]], 'codes' => [
            '188' => 'Punto II', '199' => 'Punto III (Grande/Evo)', '312' => '500', '169' => 'Panda II', '319' => 'Panda III',
            '356' => 'Tipo', '263' => 'Doblo II', '250' => 'Ducato III',
        ]],
        'Alfa Romeo' => ['at' => [[4, 3]], 'codes' => ['939' => '159', '940' => 'Giulietta', '952' => 'Giulia', '949' => 'Stelvio']],
        // Volvo: model code at chars 4–5.
        'Volvo' => ['at' => [[4, 2]], 'codes' => ['MV' => 'V40 II', 'FW' => 'V60 I', 'ZW' => 'V60 II', 'FS' => 'S60 II', 'BW' => 'V70 III', 'DZ' => 'XC60 I', 'RZ' => 'XC60 II']],
        // Porsche: model code at chars 7–8 (VAG style).
        'Porsche' => ['at' => [[7, 2]], 'codes' => ['99' => [0 => '911 (997)', 2012 => '911 (991)', 2020 => '911 (992)'], '9P' => [0 => 'Cayenne (955)', 2008 => 'Cayenne (957)'], '92' => 'Cayenne (958)', '9Y' => 'Cayenne (9YA)', '95' => 'Macan']],
        // Land Rover: model letter at char 4.
        'Land Rover' => ['at' => [[4, 1]], 'codes' => ['V' => 'Range Rover Evoque I', 'Z' => 'Range Rover Evoque II', 'F' => 'Freelander 2', 'C' => 'Discovery Sport']],
        'Tesla' => ['at' => [[4, 1]], 'codes' => ['3' => 'Model 3', 'Y' => 'Model Y', 'S' => 'Model S', 'X' => 'Model X']],
        // Infiniti (JNK = Japan-built passenger cars): line + body at chars 4–6; the G is the one that matters here.
        'Infiniti' => ['at' => [[4, 3]], 'codes' => [
            'CV6' => 'G37 (V36)', 'CV5' => 'G35 (V35)', 'CV7' => 'Q50 (V37)', 'BV7' => 'Q50 (V37)',
        ]],
        // Hyundai: line + series + body at chars 4–6 (the body digit separates e.g. i20 III from Bayon), chars 4–5 as the fallback.
        // The series letter varies within a generation, so every known letter is listed. Source: Czech registry records, EU recalls.
        'Hyundai' => ['at' => [[4, 3], [4, 2]], 'codes' => [
            'A8' => 'i10 II', 'A85' => 'i10 II', 'AM' => 'i10 I', 'AM5' => 'i10 I', 'B2' => 'i20 II', 'B3' => 'i20 II',
            'B35' => 'i20 II', 'BA' => 'i20 I', 'BA5' => 'i20 I', 'BB' => 'i20 I', 'BB5' => 'i20 I', 'BM' => ['i20 III', 'Bayon'],
            'BM5' => 'i20 III', 'BM8' => 'Bayon', 'BN' => ['i20 III', 'Bayon'], 'BN5' => 'i20 III', 'BN8' => 'Bayon', 'BR' => ['i20 III', 'Bayon'],
            'BR5' => 'i20 III', 'BR8' => 'Bayon', 'BT' => 'Getz', 'BT3' => 'Getz', 'BT5' => 'Getz', 'BU' => [0 => 'Getz', 2020 => ['i20 III', 'Bayon']],
            'BU3' => 'Getz', 'BU5' => [0 => 'Getz', 2020 => 'i20 III'], 'C6' => 'Ioniq', 'C65' => 'Ioniq', 'C7' => 'Ioniq', 'C75' => 'Ioniq',
            'C8' => 'Ioniq', 'C85' => 'Ioniq', 'CG' => 'Accent II', 'CG3' => 'Accent II', 'CG4' => 'Accent II', 'CG5' => 'Accent II',
            'CM' => 'Accent III', 'CM3' => 'Accent III', 'CM4' => 'Accent III', 'CM5' => 'Accent III', 'CN' => 'Accent III', 'CN3' => 'Accent III',
            'CN4' => 'Accent III', 'CN5' => 'Accent III', 'CT' => 'Accent IV', 'CT4' => 'Accent IV', 'CT5' => 'Accent IV', 'D3' => 'i30 II',
            'D35' => 'i30 II', 'D38' => 'i30 II', 'D8' => 'Elantra VI (AD)', 'D84' => 'Elantra VI (AD)', 'DB' => 'i30 I', 'DB5' => 'i30 I',
            'DB8' => 'i30 I', 'DC' => 'i30 I', 'DC5' => 'i30 I', 'DC8' => 'i30 I', 'DH' => 'Elantra V (MD)', 'DH4' => 'Elantra V (MD)',
            'DN' => ['i10 III', 'Elantra III (XD)'], 'DN4' => 'Elantra III (XD)', 'DN5' => 'i10 III', 'DR' => 'i10 III', 'DR5' => 'i10 III', 'DU' => 'Elantra IV (HD)',
            'DU4' => 'Elantra IV (HD)', 'EU' => 'Sonata V (NF)', 'EU4' => 'Sonata V (NF)', 'H3' => 'i30 III', 'H35' => 'i30 III', 'H38' => 'i30 III',
            'HA' => 'Kona II', 'HA8' => 'Kona II', 'HB' => 'Kona II', 'HB8' => 'Kona II', 'HC' => 'Kona II', 'HC8' => 'Kona II',
            'HE' => 'Kona II', 'HE8' => 'Kona II', 'HM' => 'Coupe (GK)', 'HM6' => 'Coupe (GK)', 'HN' => 'Coupe (GK)', 'HN6' => 'Coupe (GK)',
            'J2' => 'Tucson III', 'J3' => 'Tucson III', 'J38' => 'Tucson III', 'JB' => 'Tucson IV', 'JC' => 'Tucson IV', 'JC8' => 'Tucson IV',
            'JD' => 'Tucson IV', 'JD8' => 'Tucson IV', 'JE' => 'Tucson IV', 'JE8' => 'Tucson IV', 'JF' => 'Tucson IV', 'JN' => 'Tucson I',
            'JN8' => 'Tucson I', 'JT' => 'ix35', 'JT8' => 'ix35', 'JU' => 'ix35', 'JU8' => 'ix35', 'K1' => 'Kona I',
            'K2' => 'Kona I', 'K28' => 'Kona I', 'K3' => 'Kona I', 'K38' => 'Kona I', 'K5' => 'Kona I', 'K58' => 'Kona I',
            'KM' => 'Ioniq 5', 'KM8' => 'Ioniq 5', 'KN' => 'Ioniq 5', 'KN8' => 'Ioniq 5', 'KR' => 'Ioniq 5', 'KR8' => 'Ioniq 5',
            'LB' => 'i40', 'LB4' => 'i40', 'LB8' => 'i40', 'LC' => 'i40', 'LC4' => 'i40', 'LC8' => 'i40',
            'LD' => 'i40', 'LD4' => 'i40', 'LD8' => 'i40', 'PM' => 'Matrix', 'PM8' => 'Matrix', 'PT' => 'ix20',
            'PT8' => 'ix20', 'PU' => 'ix20', 'PU8' => 'ix20', 'S2' => 'Santa Fe IV', 'S28' => 'Santa Fe IV', 'S3' => 'Santa Fe IV',
            'S38' => 'Santa Fe IV', 'S4' => 'Santa Fe IV', 'S48' => 'Santa Fe IV', 'S5' => 'Santa Fe IV', 'S58' => 'Santa Fe IV', 'SC' => 'Santa Fe I',
            'SC8' => 'Santa Fe I', 'SH' => 'Santa Fe II', 'SH8' => 'Santa Fe II', 'SW' => 'Santa Fe III', 'SW8' => 'Santa Fe III', 'TC' => 'Veloster',
            'TC6' => 'Veloster',
        ]],
        // Kia since ~MY2010 (Hyundai-style VDS); the older scheme with a two-digit body code is KIA_OLD, see kia().
        'Kia' => ['at' => [[4, 3], [4, 2]], 'codes' => [
            'B2' => 'Picanto III', 'B25' => 'Picanto III', 'B3' => 'Picanto III', 'B35' => 'Picanto III', 'BE' => 'Picanto I', 'BE5' => 'Picanto I',
            'BF' => 'Picanto I', 'BF5' => 'Picanto I', 'BJ' => 'Picanto II', 'BJ5' => 'Picanto II', 'BX' => 'Picanto II', 'BX5' => 'Picanto II',
            'C3' => 'EV6', 'C38' => 'EV6', 'C4' => 'EV6', 'C48' => 'EV6', 'CB' => 'Niro I', 'CB8' => 'Niro I',
            'CC' => 'Niro I', 'CC8' => 'Niro I', 'CD' => 'Niro I', 'CD8' => 'Niro I', 'CR' => 'Niro II', 'CR8' => 'Niro II',
            'D6' => 'Stonic', 'D68' => 'Stonic', 'DA' => 'Stonic', 'DA8' => 'Stonic', 'DB' => 'Rio IV', 'DB5' => 'Rio IV',
            'DC' => [0 => 'Rio I', 2017 => 'Rio IV'], 'DC5' => 'Rio IV', 'DD' => 'Stonic', 'DD8' => 'Stonic', 'DN' => 'Rio III', 'DN5' => 'Rio III',
            'E3' => 'Stinger', 'E35' => 'Stinger', 'E5' => 'Stinger', 'E55' => 'Stinger', 'EG' => 'Venga', 'EG8' => 'Venga',
            'EH' => 'Venga', 'EH8' => 'Venga', 'GM' => 'Optima III', 'GM4' => 'Optima III', 'GN' => 'Optima III', 'GN4' => 'Optima III',
            'GT' => 'Optima IV', 'GT4' => 'Optima IV', 'GU' => 'Optima IV', 'GU4' => 'Optima IV', 'GU8' => 'Optima IV', 'GV' => 'Optima IV',
            'GV8' => 'Optima IV', 'H2' => ['Ceed III', 'XCeed', 'ProCeed'], 'H25' => 'Ceed III', 'H28' => 'Ceed III', 'H2F' => 'XCeed', 'H2G' => 'ProCeed',
            'H5' => ['Ceed III', 'XCeed', 'ProCeed'], 'H55' => 'Ceed III', 'H58' => 'Ceed III', 'H5F' => 'XCeed', 'H5G' => 'ProCeed', 'H6' => ['Ceed III', 'XCeed', 'ProCeed'],
            'H65' => 'Ceed III', 'H68' => 'Ceed III', 'H6F' => 'XCeed', 'H6G' => 'ProCeed', 'HB' => 'Ceed I', 'HB3' => 'Ceed I',
            'HB5' => 'Ceed I', 'HB8' => 'Ceed I', 'HC' => 'Ceed I', 'HM' => 'Ceed II', 'HM3' => 'Ceed II', 'HM5' => 'Ceed II',
            'HM8' => 'Ceed II', 'HN' => 'Ceed II', 'HN3' => 'Ceed II', 'HN5' => 'Ceed II', 'HN8' => 'Ceed II', 'HU' => 'Carens IV',
            'HU8' => 'Carens IV', 'J2' => 'e-Soul', 'J28' => 'e-Soul', 'J3' => 'e-Soul', 'J38' => 'e-Soul', 'JN' => 'Soul II',
            'JN8' => 'Soul II', 'JP' => 'Soul II', 'JP8' => 'Soul II', 'JT' => 'Soul I', 'JT8' => 'Soul I', 'JX' => 'Soul II',
            'JX8' => 'Soul II', 'KU' => 'Sorento II', 'KU8' => 'Sorento II', 'PB' => 'Sportage III', 'PB8' => 'Sportage III', 'PC' => 'Sportage III',
            'PC8' => 'Sportage III', 'PG' => 'Sorento III', 'PG8' => 'Sorento III', 'PH' => ['Sportage IV', 'Sorento III'], 'PH8' => ['Sportage IV', 'Sorento III'], 'PK' => ['Sportage IV', 'Sorento III'],
            'PK8' => ['Sportage IV', 'Sorento III'], 'PU' => 'Sportage V', 'PU8' => 'Sportage V', 'PV' => 'Sportage V', 'PV8' => 'Sportage V', 'PX' => 'Sportage V',
            'PX8' => 'Sportage V', 'RH' => 'Sorento IV', 'RH8' => 'Sorento IV', 'RM' => 'Sorento IV', 'RM8' => 'Sorento IV',
        ]],
    ];

    /** Kia before ~MY2010: model code at chars 4–5 followed by a two-digit body code (12, 21–24, 52, 55, 7x). */
    private const KIA_OLD = [
        'BA' => 'Picanto I', 'DC' => 'Rio I', 'DE' => 'Rio II', 'DG' => 'Rio II', 'FE' => 'Cerato', 'FF' => 'Ceed I',
        'FG' => 'Carens III', 'FJ' => 'Carens II', 'GD' => 'Magentis I', 'GE' => 'Magentis II', 'JC' => 'Sorento I', 'JD' => 'Sorento I',
        'JE' => 'Sportage II', 'JF' => 'Sportage II', 'MA' => 'Carnival I', 'MB' => 'Carnival II', 'MG' => 'Carnival II', 'MH' => 'Carnival II',
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
        $year = $make && in_array($make, self::MODEL_YEAR_MAKES, true) ? self::modelYear($vin[9]) : null;

        $models = [];
        $candidates = in_array($wmi, self::MAKE_ONLY_WMIS, true) ? [] : self::candidates($make, $wmi, $vin, $year);
        foreach ($candidates as $name) {
            // "Make:Model" — the VIN belongs to another make than its WMI (Cupra on Seat's WMI, Kia Venga from Nošovice).
            if (preg_match('/^(Cupra|Kia|Hyundai):(.+)$/u', $name, $m)) {
                $make = $m[1];
                $name = $m[2];
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
        $entry = self::special($make, $wmi, $vin) ?? self::lookup($make, $vin);

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

    /** The maker's table(s), trying each window of each scheme in order; the first hit wins. */
    private static function lookup(?string $make, string $vin): string|array|null
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

    /** Makers whose model needs more than a table: the WMI or two schemes decide. */
    private static function special(?string $make, string $wmi, string $vin): string|array|null
    {
        return match ($make) {
            // 247 is the B-Class on W1K/WDD and the GLA on W1N/WDC.
            'Mercedes-Benz' => substr($vin, 3, 3) === '247' ? (in_array($wmi, ['W1N', 'WDC'], true) ? 'GLA (H247)' : 'B (W247)') : null,
            'Jaguar' => self::jaguar($wmi, $vin[3]),
            'Jeep' => $wmi === '1C4' && substr($vin, 3, 2) === 'RJ' ? 'Grand Cherokee WK2' : null,
            'Opel' => self::opel($vin),
            'Hyundai' => self::hyundai($wmi, $vin),
            'Kia' => self::kia($wmi, $vin),
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
