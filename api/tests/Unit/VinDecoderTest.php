<?php

namespace Tests\Unit;

use App\Support\VehicleCatalog;
use App\Support\VinDecoder;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class VinDecoderTest extends TestCase
{
    /**
     * Real VINs with the model the source states (Czech vehicle registry, EU recall notices,
     * auction records), so each row checks the decoder against the car itself.
     *
     * @return array<string, array{0: string, 1: string, 2: string, 3: int|null}>
     */
    public static function realVins(): array
    {
        return [
            'MALAM51BP9M354435' => ['MALAM51BP9M354435', 'Hyundai', 'i10 I', 2009],
            'NLHA851AAJZ406260' => ['NLHA851AAJZ406260', 'Hyundai', 'i10 II', 2018],
            'NLHDN51AAMZ097181' => ['NLHDN51AAMZ097181', 'Hyundai', 'i10 III', 2021],
            'NLHBA51BADZ145704' => ['NLHBA51BADZ145704', 'Hyundai', 'i20 I', 2013],
            'NLHB351CLFZ028623' => ['NLHB351CLFZ028623', 'Hyundai', 'i20 II', 2015],
            'NLHBN51GAPZ218883' => ['NLHBN51GAPZ218883', 'Hyundai', 'i20 III', 2023],
            'NLHBN81GGNZ198620' => ['NLHBN81GGNZ198620', 'Hyundai', 'Bayon', 2022],
            'TMADB51CACJ257825' => ['TMADB51CACJ257825', 'Hyundai', 'i30 I', 2012],
            'TMAD381UAEJ060041' => ['TMAD381UAEJ060041', 'Hyundai', 'i30 II', 2014],
            'TMAH351DGNJ194443' => ['TMAH351DGNJ194443', 'Hyundai', 'i30 III', 2022],
            'KMHLD81UGGU121747' => ['KMHLD81UGGU121747', 'Hyundai', 'i40', 2016],
            'TMAPT81DBDJ096756' => ['TMAPT81DBDJ096756', 'Hyundai', 'ix20', 2013],
            'TMAJU81UADJ429618' => ['TMAJU81UADJ429618', 'Hyundai', 'ix35', 2013],
            'TMAJ3812VLJ901141' => ['TMAJ3812VLJ901141', 'Hyundai', 'Tucson III', 2020],
            'TMAJE812DNJ039417' => ['TMAJE812DNJ039417', 'Hyundai', 'Tucson IV', 2022],
            'KMHK581GFLU072819' => ['KMHK581GFLU072819', 'Hyundai', 'Kona I', 2020],
            'KMHS581HHMU401509' => ['KMHS581HHMU401509', 'Hyundai', 'Santa Fe IV', 2021],
            'KMHBT51DP6U622342' => ['KMHBT51DP6U622342', 'Hyundai', 'Getz', 2006],
            'KMHHN61DR6U199286' => ['KMHHN61DR6U199286', 'Hyundai', 'Coupe (GK)', 2006],
            'KMHCM31AP6U000229' => ['KMHCM31AP6U000229', 'Hyundai', 'Accent III', 2006],
            'KMHC751DGNU270486' => ['KMHC751DGNU270486', 'Hyundai', 'Ioniq', 2022],
            'KNEBA24425T193077' => ['KNEBA24425T193077', 'Kia', 'Picanto I', 2005],
            'KNABX512LDT591377' => ['KNABX512LDT591377', 'Kia', 'Picanto II', 2013],
            'KNAB2511AKT569566' => ['KNAB2511AKT569566', 'Kia', 'Picanto III', 2019],
            'KNADN511AC6746630' => ['KNADN511AC6746630', 'Kia', 'Rio III', 2012],
            'KNADC511AH6033686' => ['KNADC511AH6033686', 'Kia', 'Rio IV', 2017],
            'KNAD6817AM6487603' => ['KNAD6817AM6487603', 'Kia', 'Stonic', 2021],
            'U5YFF24129L137365' => ['U5YFF24129L137365', 'Kia', 'Ceed I', 2009],
            'U5YHB511ACL299954' => ['U5YHB511ACL299954', 'Kia', 'Ceed I', 2012],
            'U5YHN512ADL060036' => ['U5YHN512ADL060036', 'Kia', 'Ceed II', 2013],
            'U5YHN816AEL074587' => ['U5YHN816AEL074587', 'Kia', 'Ceed II', 2014],
            'U5YH581AGRL053303' => ['U5YH581AGRL053303', 'Kia', 'Ceed III', 2024],
            'U5YH5F1AGLL006548' => ['U5YH5F1AGLL006548', 'Kia', 'XCeed', 2020],
            'U5YH6G17GNL051265' => ['U5YH6G17GNL051265', 'Kia', 'ProCeed', 2022],
            'TMAEG811ABJ034512' => ['TMAEG811ABJ034512', 'Kia', 'Venga', 2011],
            'U5YEG811ADL033991' => ['U5YEG811ADL033991', 'Kia', 'Venga', 2013],
            'KNEJE55257K388258' => ['KNEJE55257K388258', 'Kia', 'Sportage II', 2007],
            'U5YPC813DCL186012' => ['U5YPC813DCL186012', 'Kia', 'Sportage III', 2012], // first registered 28. 6. 2012, char 10 = C
            'U5YPH813NGL053011' => ['U5YPH813NGL053011', 'Kia', 'Sportage IV', 2016],
            'U5YPV81HDNL027287' => ['U5YPV81HDNL027287', 'Kia', 'Sportage V', 2022],
            'KNAPH81BBFA117239' => ['KNAPH81BBFA117239', 'Kia', 'Sorento III', 2015],
            'KNAPG81ABLA605906' => ['KNAPG81ABLA605906', 'Kia', 'Sorento III', 2020],
            'KNARM81HDM5048132' => ['KNARM81HDM5048132', 'Kia', 'Sorento IV', 2021],
            'KNAJT811AA7130766' => ['KNAJT811AA7130766', 'Kia', 'Soul I', 2010],
            'KNAJ3811FM7022496' => ['KNAJ3811FM7022496', 'Kia', 'e-Soul', 2021],
            'KNACB81CGM5448044' => ['KNACB81CGM5448044', 'Kia', 'Niro I', 2021],
            'KNACR811FP5026633' => ['KNACR811FP5026633', 'Kia', 'Niro II', 2023],
            'KNAC381AFP5106721' => ['KNAC381AFP5106721', 'Kia', 'EV6', 2023],
            'KNAHU815GH7169610' => ['KNAHU815GH7169610', 'Kia', 'Carens IV', 2017],
            'KNAGU417GK5351001' => ['KNAGU417GK5351001', 'Kia', 'Optima IV', 2019],
            'KNAGV81FBL5047171' => ['KNAGV81FBL5047171', 'Kia', 'Optima IV', 2020],
        ];
    }

    #[DataProvider('realVins')]
    public function test_real_vin_decodes_to_its_model(string $vin, string $make, string $model, ?int $year): void
    {
        $decoded = VinDecoder::decode($vin);

        $this->assertTrue($decoded['valid']);
        $this->assertSame($make, $decoded['make']);
        $this->assertSame([$model], $decoded['models']);
        if ($year !== null) {
            $this->assertSame($year, $decoded['year']);
        }
    }

    public function test_kia_built_ix35_and_shared_sportage_sorento_code(): void
    {
        // Rule checks (synthetic serials): Žilina's ix35 carries Kia's WMI; PH/PK is Sportage on U5Y and decided by the plant on KNA.
        $this->assertSame(['make' => 'Hyundai', 'models' => ['ix35']], array_intersect_key(VinDecoder::decode('U5YJU81UADL000001'), ['make' => 1, 'models' => 1]));
        $this->assertSame(['Sportage IV'], VinDecoder::decode('KNAPH81BDH7000001')['models']);
        $this->assertSame(['Sportage IV', 'Sorento III'], VinDecoder::decode('KNAPH81BDH9000001')['models']);
    }

    public function test_north_american_builds_get_the_make_but_no_european_model(): void
    {
        $decoded = VinDecoder::decode('5NMS33AD0KH000001');

        $this->assertSame('Hyundai', $decoded['make']);
        $this->assertSame([], $decoded['models']);
    }

    /** Whatever the decoder can answer must be a model of that make in the bundled catalogue, or the picker would create a duplicate. */
    public function test_every_model_the_decoder_knows_is_in_the_catalogue(): void
    {
        // Model names like "206" become integer array keys in PHP, hence the cast.
        $catalogue = array_map(fn (array $def) => array_map(strval(...), array_keys($def['models'])), VehicleCatalog::makes());
        $constants = (new ReflectionClass(VinDecoder::class))->getConstants();
        $tables = array_map(fn (array $scheme) => array_merge(...array_map(fn (array $part) => array_values($part['codes']), array_is_list($scheme) ? $scheme : [$scheme])), $constants['SCHEMES']);
        $tables['Kia'] = array_merge($tables['Kia'], $constants['KIA_OLD']);

        $missing = [];
        foreach ($tables as $make => $codes) {
            array_walk_recursive($codes, function (string $name) use ($make, $catalogue, &$missing): void {
                [$owner, $model] = str_contains($name, ':') && preg_match('/^(Cupra|Kia|Hyundai):(.+)$/u', $name, $m) ? [$m[1], $m[2]] : [$make, $name];
                if (! in_array($model, $catalogue[$owner] ?? [], true)) {
                    $missing[] = "$owner / $model";
                }
            });
        }
        foreach (self::realVins() as [, $make, $model]) {
            if (! in_array($model, $catalogue[$make] ?? [], true)) {
                $missing[] = "$make / $model (test VIN)";
            }
        }

        $this->assertSame([], array_values(array_unique($missing)));
    }
}
