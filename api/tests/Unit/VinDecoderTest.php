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
     * auction records), so each row checks the decoder against the car itself. Row: VIN, make,
     * the models the decoder must answer (several when the VIN cannot tell them apart, none when
     * the generation is outside the catalogue), the model year (null = not encoded, false = not checked).
     *
     * @return array<string, array{0: string, 1: string, 2: list<string>, 3: int|false|null}>
     */
    public static function realVins(): array
    {
        return [
            'MALAM51BP9M354435' => ['MALAM51BP9M354435', 'Hyundai', ['i10 I'], 2009],
            'NLHA851AAJZ406260' => ['NLHA851AAJZ406260', 'Hyundai', ['i10 II'], 2018],
            'NLHDN51AAMZ097181' => ['NLHDN51AAMZ097181', 'Hyundai', ['i10 III'], 2021],
            'NLHBA51BADZ145704' => ['NLHBA51BADZ145704', 'Hyundai', ['i20 I'], 2013],
            'NLHB351CLFZ028623' => ['NLHB351CLFZ028623', 'Hyundai', ['i20 II'], 2015],
            'NLHBN51GAPZ218883' => ['NLHBN51GAPZ218883', 'Hyundai', ['i20 III'], 2023],
            'NLHBN81GGNZ198620' => ['NLHBN81GGNZ198620', 'Hyundai', ['Bayon'], 2022],
            'TMADB51CACJ257825' => ['TMADB51CACJ257825', 'Hyundai', ['i30 I'], 2012],
            'TMAD381UAEJ060041' => ['TMAD381UAEJ060041', 'Hyundai', ['i30 II'], 2014],
            'TMAH351DGNJ194443' => ['TMAH351DGNJ194443', 'Hyundai', ['i30 III'], 2022],
            'KMHLD81UGGU121747' => ['KMHLD81UGGU121747', 'Hyundai', ['i40'], 2016],
            'TMAPT81DBDJ096756' => ['TMAPT81DBDJ096756', 'Hyundai', ['ix20'], 2013],
            'TMAJU81UADJ429618' => ['TMAJU81UADJ429618', 'Hyundai', ['ix35'], 2013],
            'TMAJ3812VLJ901141' => ['TMAJ3812VLJ901141', 'Hyundai', ['Tucson III'], 2020],
            'TMAJE812DNJ039417' => ['TMAJE812DNJ039417', 'Hyundai', ['Tucson IV'], 2022],
            'KMHK581GFLU072819' => ['KMHK581GFLU072819', 'Hyundai', ['Kona I'], 2020],
            'KMHS581HHMU401509' => ['KMHS581HHMU401509', 'Hyundai', ['Santa Fe IV'], 2021],
            'KMHBT51DP6U622342' => ['KMHBT51DP6U622342', 'Hyundai', ['Getz'], 2006],
            'KMHHN61DR6U199286' => ['KMHHN61DR6U199286', 'Hyundai', ['Coupe (GK)'], 2006],
            'KMHCM31AP6U000229' => ['KMHCM31AP6U000229', 'Hyundai', ['Accent III'], 2006],
            'KMHC751DGNU270486' => ['KMHC751DGNU270486', 'Hyundai', ['Ioniq'], 2022],
            'KNEBA24425T193077' => ['KNEBA24425T193077', 'Kia', ['Picanto I'], 2005],
            'KNABX512LDT591377' => ['KNABX512LDT591377', 'Kia', ['Picanto II'], 2013],
            'KNAB2511AKT569566' => ['KNAB2511AKT569566', 'Kia', ['Picanto III'], 2019],
            'KNADN511AC6746630' => ['KNADN511AC6746630', 'Kia', ['Rio III'], 2012],
            'KNADC511AH6033686' => ['KNADC511AH6033686', 'Kia', ['Rio IV'], 2017],
            'KNAD6817AM6487603' => ['KNAD6817AM6487603', 'Kia', ['Stonic'], 2021],
            'U5YFF24129L137365' => ['U5YFF24129L137365', 'Kia', ['Ceed I'], 2009],
            'U5YHB511ACL299954' => ['U5YHB511ACL299954', 'Kia', ['Ceed I'], 2012],
            'U5YHN512ADL060036' => ['U5YHN512ADL060036', 'Kia', ['Ceed II'], 2013],
            'U5YHN816AEL074587' => ['U5YHN816AEL074587', 'Kia', ['Ceed II'], 2014],
            'U5YH581AGRL053303' => ['U5YH581AGRL053303', 'Kia', ['Ceed III'], 2024],
            'U5YH5F1AGLL006548' => ['U5YH5F1AGLL006548', 'Kia', ['XCeed'], 2020],
            'U5YH6G17GNL051265' => ['U5YH6G17GNL051265', 'Kia', ['ProCeed'], 2022],
            'TMAEG811ABJ034512' => ['TMAEG811ABJ034512', 'Kia', ['Venga'], 2011],
            'U5YEG811ADL033991' => ['U5YEG811ADL033991', 'Kia', ['Venga'], 2013],
            'KNEJE55257K388258' => ['KNEJE55257K388258', 'Kia', ['Sportage II'], 2007],
            'U5YPC813DCL186012' => ['U5YPC813DCL186012', 'Kia', ['Sportage III'], 2012], // first registered 28. 6. 2012, char 10 = C
            'U5YPH813NGL053011' => ['U5YPH813NGL053011', 'Kia', ['Sportage IV'], 2016],
            'U5YPV81HDNL027287' => ['U5YPV81HDNL027287', 'Kia', ['Sportage V'], 2022],
            'KNAPH81BBFA117239' => ['KNAPH81BBFA117239', 'Kia', ['Sorento III'], 2015],
            'KNAPG81ABLA605906' => ['KNAPG81ABLA605906', 'Kia', ['Sorento III'], 2020],
            'KNARM81HDM5048132' => ['KNARM81HDM5048132', 'Kia', ['Sorento IV'], 2021],
            'KNAJT811AA7130766' => ['KNAJT811AA7130766', 'Kia', ['Soul I'], 2010],
            'KNAJ3811FM7022496' => ['KNAJ3811FM7022496', 'Kia', ['e-Soul'], 2021],
            'KNACB81CGM5448044' => ['KNACB81CGM5448044', 'Kia', ['Niro I'], 2021],
            'KNACR811FP5026633' => ['KNACR811FP5026633', 'Kia', ['Niro II'], 2023],
            'KNAC381AFP5106721' => ['KNAC381AFP5106721', 'Kia', ['EV6'], 2023],
            'KNAHU815GH7169610' => ['KNAHU815GH7169610', 'Kia', ['Carens IV'], 2017],
            'KNAGU417GK5351001' => ['KNAGU417GK5351001', 'Kia', ['Optima IV'], 2019],
            'KNAGV81FBL5047171' => ['KNAGV81FBL5047171', 'Kia', ['Optima IV'], 2020],
            'WBAUF11010JR90054' => ['WBAUF11010JR90054', 'BMW', ['1 (E87)'], false], // https://auto.ria.com/uk/auto_bmw_1-series_40542225.html
            'WBA1A11070J147722' => ['WBA1A11070J147722', 'BMW', ['1 (F20)'], false], // https://auto.ria.com/uk/auto_bmw_1-series_39627025.html
            'WBA7M9106L7F61224' => ['WBA7M9106L7F61224', 'BMW', ['1 (F40)'], false], // https://auto.ria.com/uk/auto_bmw_1-series_40563606.html
            'WBAEL71050PL56162' => ['WBAEL71050PL56162', 'BMW', ['3 (E46)'], false], // https://auto.ria.com/uk/auto_bmw_3-series_40577541.html
            'WBAVF11000A013234' => ['WBAVF11000A013234', 'BMW', ['3 (E90)'], false], // https://auto.ria.com/uk/auto_bmw_3-series_38086976.html
            'WBAVU31040KY43680' => ['WBAVU31040KY43680', 'BMW', ['3 (E90)'], false], // https://auto.ria.com/uk/auto_bmw_3-series_40570520.html
            'WBA3Y51040D660520' => ['WBA3Y51040D660520', 'BMW', ['3 (F30)'], false], // https://auto.ria.com/uk/auto_bmw_3-series-gt_40564337.html
            'WBA5F31040FM85189' => ['WBA5F31040FM85189', 'BMW', ['3 (G20)'], false], // https://auto.ria.com/uk/auto_bmw_3-series_39411769.html
            'WBA11DZ010FM88669' => ['WBA11DZ010FM88669', 'BMW', ['3 (G20)'], false], // https://auto.ria.com/uk/auto_bmw_3-series_39924533.html
            'WBA71FF090FT87650' => ['WBA71FF090FT87650', 'BMW', ['3 (G20)'], false], // https://auto.ria.com/uk/auto_bmw_3-series_40013956.html
            'WBA2C11020V973157' => ['WBA2C11020V973157', 'BMW', ['2 Active Tourer (F45)'], false], // https://auto.ria.com/uk/auto_bmw_2-series-active-tourer_40308800.html
            'WBA2E510405H14870' => ['WBA2E510405H14870', 'BMW', ['2 Gran Tourer (F46)'], false], // https://auto.ria.com/uk/auto_bmw_2-series-gran-tourer_34984776.html
            'WBA3P11080K263108' => ['WBA3P11080K263108', 'BMW', ['4 (F32)'], false], // https://auto.ria.com/uk/auto_bmw_4-series_38929695.html
            'WBA11AP050CH03685' => ['WBA11AP050CH03685', 'BMW', ['4 (G22)'], false], // https://auto.ria.com/uk/auto_bmw_4-series_40448950.html
            'WBY73AW0XRFR74533' => ['WBY73AW0XRFR74533', 'BMW', ['i4 (G26)'], false], // https://auto.ria.com/uk/auto_bmw_i4_40578805.html
            'WBADD31070BU22046' => ['WBADD31070BU22046', 'BMW', ['5 (E39)'], false], // https://auto.ria.com/uk/auto_bmw_5-series_40115387.html
            'WBAFW11080C279948' => ['WBAFW11080C279948', 'BMW', ['5 (F10)'], false], // https://auto.ria.com/uk/auto_bmw_5-series_40574651.html
            'WBAMX11030DY09077' => ['WBAMX11030DY09077', 'BMW', ['5 (F10)'], false], // https://auto.ria.com/uk/auto_bmw_5-series_40364036.html
            'WBA5N2107GG268074' => ['WBA5N2107GG268074', 'BMW', ['5 GT (F07)'], false], // https://auto.ria.com/uk/auto_bmw_5-series-gt_40297901.html
            'WBAJE31050B315836' => ['WBAJE31050B315836', 'BMW', ['5 (G30)'], false], // https://auto.ria.com/uk/auto_bmw_5-series_40194609.html
            'WBAVP31040VP72499' => ['WBAVP31040VP72499', 'BMW', ['X1 (E84)'], false], // https://auto.ria.com/uk/auto_bmw_x1_40311169.html
            'WBAHT910003E99636' => ['WBAHT910003E99636', 'BMW', ['X1 (F48)'], false], // https://auto.ria.com/uk/auto_bmw_x1_40480786.html
            'WBA11EG0505Z36328' => ['WBA11EG0505Z36328', 'BMW', ['X1 (U11)'], false], // https://auto.ria.com/uk/auto_bmw_x1_40234655.html
            'WBAYK51040EK19603' => ['WBAYK51040EK19603', 'BMW', ['X2 (F39)'], false], // https://auto.ria.com/uk/auto_bmw_x2_40563379.html
            'WBAPE11000WK09320' => ['WBAPE11000WK09320', 'BMW', ['X3 (E83)'], false], // https://auto.ria.com/uk/auto_bmw_x3_40196513.html
            'WBAWY310300A54220' => ['WBAWY310300A54220', 'BMW', ['X3 (F25)'], false], // https://auto.ria.com/uk/auto_bmw_x3_39983144.html
            'WBATX31070LB64448' => ['WBATX31070LB64448', 'BMW', ['X3 (G01)'], false], // https://auto.ria.com/uk/auto_bmw_x3_40229367.html
            'WBA11GR0209Z37129' => ['WBA11GR0209Z37129', 'BMW', ['X3 (G45)'], false], // https://auto.ria.com/uk/auto_bmw_x3_40574439.html
            'WBAXX110X00T36122' => ['WBAXX110X00T36122', 'BMW', ['X4 (F26)'], false], // https://auto.ria.com/uk/auto_bmw_x4_40529358.html
            'WBA2V510509G14656' => ['WBA2V510509G14656', 'BMW', ['X4 (G02)'], false], // https://auto.ria.com/uk/auto_bmw_x4_40396969.html
            'WBAFB71070LV60914' => ['WBAFB71070LV60914', 'BMW', ['X5 (E53)'], false], // https://auto.ria.com/uk/auto_bmw_x5_40572934.html
            'WBAZW61030L576619' => ['WBAZW61030L576619', 'BMW', ['X5 (E70)'], false], // https://auto.ria.com/uk/auto_bmw_x5_40579823.html
            'WBAKS410500H51846' => ['WBAKS410500H51846', 'BMW', ['X5 (F15)'], false], // https://auto.ria.com/uk/auto_bmw_x5_37563454.html
            'WBACV61060LJ84629' => ['WBACV61060LJ84629', 'BMW', ['X5 (G05)'], false], // https://auto.ria.com/uk/auto_bmw_x5_40426686.html
            'WBA21EU0509S58794' => ['WBA21EU0509S58794', 'BMW', ['X5 (G05)'], false], // https://auto.ria.com/uk/auto_bmw_x5_39921390.html
            'WBAFG21070L514763' => ['WBAFG21070L514763', 'BMW', ['X6 (E71)'], false], // https://auto.ria.com/uk/auto_bmw_x6_40395088.html
            'WBAKU210200V51549' => ['WBAKU210200V51549', 'BMW', ['X6 (F16)'], false], // https://auto.ria.com/uk/auto_bmw_x6_40573164.html
            'WBAGT610709E72344' => ['WBAGT610709E72344', 'BMW', ['X6 (G06)'], false], // https://auto.ria.com/uk/auto_bmw_x6_40539930.html
            'WBY1Z21040VZ62629' => ['WBY1Z21040VZ62629', 'BMW', ['i3'], false], // https://auto.ria.com/uk/auto_bmw_i3_40564241.html
            'WMWRC31090TH50770' => ['WMWRC31090TH50770', 'Mini', ['Cooper (R50/R53)'], false], // https://auto.ria.com/uk/auto_mini_cooper_40511840.html
            'WMWRF31050TF46474' => ['WMWRF31050TF46474', 'Mini', ['Cooper (R50/R53)'], false], // https://auto.ria.com/uk/auto_mini_convertible_40256770.html
            'WMWSR11020TY56477' => ['WMWSR11020TY56477', 'Mini', ['Cooper (R56)'], false], // https://auto.ria.com/uk/auto_mini_hatch_36140639.html
            'WMWSU31020T446661' => ['WMWSU31020T446661', 'Mini', ['Cooper (R56)'], false], // https://auto.ria.com/uk/auto_mini_hatch_39865458.html
            'WMWZR31070T165004' => ['WMWZR31070T165004', 'Mini', ['Cooper (R56)'], false], // https://auto.ria.com/uk/auto_mini_convertible_32983227.html
            'WMWXD31060WP94869' => ['WMWXD31060WP94869', 'Mini', ['Countryman (R60)'], false], // https://auto.ria.com/uk/auto_mini_countryman_40302346.html
            'WMWZD51040WN08327' => ['WMWZD51040WN08327', 'Mini', ['Countryman (R60)'], false], // https://auto.ria.com/uk/auto_mini_countryman_40404067.html
            'WMWRS31090WN42578' => ['WMWRS31090WN42578', 'Mini', ['Paceman (R61)'], false], // https://auto.ria.com/uk/auto_mini_paceman_39365846.html
            'WMWXR510502N52126' => ['WMWXR510502N52126', 'Mini', ['Cooper (F56)'], false], // https://auto.ria.com/uk/auto_mini_cooper_40392899.html
            'WMW21DH0502R47599' => ['WMW21DH0502R47599', 'Mini', ['Cooper (F56)'], false], // https://auto.ria.com/uk/auto_mini_hatch_40430516.html
            'WMWWG5C54G3C19319' => ['WMWWG5C54G3C19319', 'Mini', ['Cooper (F56)'], false], // https://auto.ria.com/uk/auto_mini_convertible_38433336.html
            'WMWLR9102J2E70221' => ['WMWLR9102J2E70221', 'Mini', ['Clubman (F54)'], false], // https://auto.ria.com/uk/auto_mini_clubman_40389264.html
            'WMZYU7C50K3F93659' => ['WMZYU7C50K3F93659', 'Mini', ['Countryman (F60)'], false], // https://auto.ria.com/uk/auto_mini_countryman_40545281.html
            'WMZ53GA09S7T19038' => ['WMZ53GA09S7T19038', 'Mini', ['Countryman (U25)'], false], // https://auto.ria.com/uk/auto_mini_countryman_40522522.html
            'WF0GXXGCDG9E13283' => ['WF0GXXGCDG9E13283', 'Ford', ['Focus II'], false], // https://fastcarcheck.uk/vin-check/WF0GXXGCDG9E13283
            'WF0YXXTTGYPY04949' => ['WF0YXXTTGYPY04949', 'Ford', ['Transit Custom II', 'Tourneo Custom II'], false], // https://fastcarcheck.uk/vin-check/WF0YXXTTGYPY04949
            'WF0FXXWPMHPL27941' => ['WF0FXXWPMHPL27941', 'Ford', ['Kuga III'], false], // https://fastcarcheck.uk/vin-check/WF0FXXWPMHPL27941
            'WF0JXXWPCJGT50643' => ['WF0JXXWPCJGT50643', 'Ford', ['S-Max II'], false], // https://fastcarcheck.uk/vin-check/WF0JXXWPCJGT50643
            'WF0JXXWPCJJA13295' => ['WF0JXXWPCJJA13295', 'Ford', ['S-Max II'], false], // https://www.elektroda.pl/rtvforum/topic3973058.html
            'WF05XXGCC5HG17520' => ['WF05XXGCC5HG17520', 'Ford', ['Focus III'], false], // https://fastcarcheck.uk/vin-check/WF05XXGCC5HG17520
            'YV1DZ7054B2169049' => ['YV1DZ7054B2169049', 'Volvo', ['XC60 I'], false], // https://fastcarcheck.uk/vin-check/YV1DZ7054B2169049
            'YV1LFBABDH1184109' => ['YV1LFBABDH1184109', 'Volvo', ['XC90 II'], false], // https://fastcarcheck.uk/vin-check/YV1LFBABDH1184109
            'YV1XZ72B1K2113602' => ['YV1XZ72B1K2113602', 'Volvo', ['XC40', 'EX40 (XC40 Recharge)'], false], // https://fastcarcheck.uk/vin-check/YV1XZ72B1K2113602
            'YV1ZWHEV3V2712064' => ['YV1ZWHEV3V2712064', 'Volvo', ['V60 II'], false], // https://fastcarcheck.uk/vin-check/YV1ZWHEV3V2712064
            'JTMBH31V105016613' => ['JTMBH31V105016613', 'Toyota', ['RAV4 III'], false], // https://www.uokik.gov.pl/download.php?plik=12321
            'SB1KC58E70F004142' => ['SB1KC58E70F004142', 'Toyota', ['Auris I'], false], // https://www.uokik.gov.pl/download.php?plik=12321
            'NMTJM58E20R001068' => ['NMTJM58E20R001068', 'Toyota', ['Auris I'], false], // https://www.uokik.gov.pl/download.php?plik=12321
            'JTNBV56E002000610' => ['JTNBV56E002000610', 'Toyota', ['Corolla E15'], false], // https://www.uokik.gov.pl/download.php?plik=12321
            'AHTLD58E703001310' => ['AHTLD58E703001310', 'Toyota', ['Corolla E15'], false], // https://www.uokik.gov.pl/download.php?plik=12321
            'VNKKL983X0A095932' => ['VNKKL983X0A095932', 'Toyota', ['Yaris II'], false], // https://www.uokik.gov.pl/download.php?plik=12321
            'VNKKV12330A003760' => ['VNKKV12330A003760', 'Toyota', ['Yaris I'], false], // https://www.uokik.gov.pl/download.php?plik=13150
            'SB1KM22E10E000534' => ['SB1KM22E10E000534', 'Toyota', ['Corolla E12'], false], // https://www.uokik.gov.pl/download.php?plik=13150
            'SB1BR56L90E001295' => ['SB1BR56L90E001295', 'Toyota', ['Avensis II'], false], // https://www.uokik.gov.pl/download.php?plik=13150
            'JTEGH22B800001491' => ['JTEGH22B800001491', 'Toyota', ['Avensis Verso'], false], // https://www.uokik.gov.pl/download.php?plik=13150
            'VNKKJ3D300A001212' => ['VNKKJ3D300A001212', 'Toyota', ['Yaris III'], false], // https://www.uokik.gov.pl/download.php?plik=13508
            'VNKKL0D300A004202' => ['VNKKL0D300A004202', 'Toyota', ['Yaris III'], false], // https://www.uokik.gov.pl/download.php?plik=13508
            'JTDKJ3C3001005352' => ['JTDKJ3C3001005352', 'Toyota', ['Verso-S'], false], // https://www.uokik.gov.pl/download.php?plik=13508
            'NMTDM26R90R000503' => ['NMTDM26R90R000503', 'Toyota', ['Verso'], false], // https://www.uokik.gov.pl/download.php?plik=17539
            'JTDKN36U101096611' => ['JTDKN36U101096611', 'Toyota', ['Prius III'], false], // https://www.uokik.gov.pl/download.php?plik=18185
            'NMTKZ3BX40R000511' => ['NMTKZ3BX40R000511', 'Toyota', ['C-HR I'], false], // https://s5.dziennik.pl/pliki/10362000/10362468-lista-nr-vin-samochodow-marki-toy
            'NMTK33BX40R018816' => ['NMTK33BX40R018816', 'Toyota', ['C-HR I'], false], // https://carsbat.com/de/detail/nmtk33bx40r018816-dnroa3/
            'SB1MS3JE80E230335' => ['SB1MS3JE80E230335', 'Toyota', ['Auris II'], false], // https://carsbat.com/de/detail/sb1ms3je80e230335-fbzuqw/
            'SB1ZS3JE80E447843' => ['SB1ZS3JE80E447843', 'Toyota', ['Auris II'], false], // https://carsbat.com/de/detail/sb1zs3je80e447843-70svsq/
            'SB1Z93BE70E039764' => ['SB1Z93BE70E039764', 'Toyota', ['Corolla XII'], false], // https://carsbat.com/de/detail/sb1z93be70e039764-cbhvrs/
            'SB1ZB3AE70E082944' => ['SB1ZB3AE70E082944', 'Toyota', ['Corolla XII'], false], // https://carsbat.com/de/detail/sb1zb3ae70e082944-mgdo45/
            'YARKBAC3X00117143' => ['YARKBAC3X00117143', 'Toyota', ['Yaris IV'], false], // https://carsbat.com/de/detail/yarkbac3x00117143-4miepn/
            'YARKAAC3000012341' => ['YARKAAC3000012341', 'Toyota', ['Yaris IV'], false], // https://carsbat.com/de/detail/yarkaac3000012341-5jeb3h/
            'SB1BG76L30E113334' => ['SB1BG76L30E113334', 'Toyota', ['Avensis III'], false], // https://carsbat.com/de/detail/sb1bg76l30e113334-con1xe/
            'SB1EG76L20E068819' => ['SB1EG76L20E068819', 'Toyota', ['Avensis III'], false], // https://carsbat.com/en/detail/loggain-ydiujh/
            'JTDKGNEC40N119189' => ['JTDKGNEC40N119189', 'Toyota', ['Aygo II'], false], // https://partsouq.com/de/catalog/toyota/search/JTDKGNEC40N119189
            'JTMDJREV5GD008783' => ['JTMDJREV5GD008783', 'Toyota', ['RAV4 IV'], false], // https://forcar.org/vin-check/JTMDJREV5GD008783/
            'JTMRWRFV5KD004201' => ['JTMRWRFV5KD004201', 'Toyota', ['RAV4 V'], false], // https://forcar.org/vin-check/JTMRWRFV5KD004201/
            'AHTFR22G606058460' => ['AHTFR22G606058460', 'Toyota', ['Hilux VII'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/65993390
            'AHTCR12G208600672' => ['AHTCR12G208600672', 'Toyota', ['Hilux VII'], false], // https://www.uokik.gov.pl/download.php?plik=13714
            'AHTHB3CC002021412' => ['AHTHB3CC002021412', 'Toyota', ['Hilux VIII'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/70994234
            'AHTKB3CD502605464' => ['AHTKB3CD502605464', 'Toyota', ['Hilux VIII'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/00283924
            'JTMABBBA80A105475' => ['JTMABBBA80A105475', 'Toyota', ['bZ4X'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/65993390
            'JTMADDFB00J011776' => ['JTMADDFB00J011776', 'Toyota', ['bZ4X'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/70994234
            'YARVEEHTMGZ242802' => ['YARVEEHTMGZ242802', 'Toyota', ['Proace II'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/60609460
            'YAREFYHT2GJ983936' => ['YAREFYHT2GJ983936', 'Toyota', ['Proace City'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/42196451
            'JTJHF31U402006132' => ['JTJHF31U402006132', 'Lexus', ['RX II'], false], // https://www.uokik.gov.pl/download.php?plik=9220
            'JTJHW31U500003364' => ['JTJHW31U500003364', 'Lexus', ['RX II'], false], // https://www.uokik.gov.pl/download.php?plik=13820
            'JTHBK262X05002945' => ['JTHBK262X05002945', 'Lexus', ['IS II'], false], // https://www.uokik.gov.pl/download.php?plik=9220
            'JTHBB262002000526' => ['JTHBB262002000526', 'Lexus', ['IS II'], false], // https://www.uokik.gov.pl/download.php?plik=9220
            'JTHBH96S805011862' => ['JTHBH96S805011862', 'Lexus', ['GS III'], false], // https://www.uokik.gov.pl/download.php?plik=9220
            'JTHBL46F305054770' => ['JTHBL46F305054770', 'Lexus', ['LS IV'], false], // https://www.uokik.gov.pl/download.php?plik=15665
            'JTJBJRBZ502169809' => ['JTJBJRBZ502169809', 'Lexus', ['NX I'], false], // https://carsbat.com/de/detail/jtjbjrbz502169809-nnfowx/
            'JTJBJRBZ5J2091047' => ['JTJBJRBZ5J2091047', 'Lexus', ['NX I'], false], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/JTJBJRBZ5J2091047?format
            'JTHY65BH702145993' => ['JTHY65BH702145993', 'Lexus', ['UX'], false], // https://carsbat.com/de/detail/jthy65bh702145993-xij5au/
            'JTHP9JBH8N2060065' => ['JTHP9JBH8N2060065', 'Lexus', ['UX'], false], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/JTHP9JBH8N2060065?format
            'JTHB21B12K2036003' => ['JTHB21B12K2036003', 'Lexus', ['ES VII'], false], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/JTHB21B12K2036003?format
            'TSMEYB21S00714954' => ['TSMEYB21S00714954', 'Suzuki', ['SX4'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/00283924
            'TSMEYB21S00821699' => ['TSMEYB21S00821699', 'Suzuki', ['SX4'], false], // https://www.uokik.gov.pl/download.php?plik=16077
            'TSMJYA22S00100253' => ['TSMJYA22S00100253', 'Suzuki', ['SX4 S-Cross'], false], // https://www.uokik.gov.pl/download.php?plik=16077
            'TSMLYE21S00144910' => ['TSMLYE21S00144910', 'Suzuki', ['Vitara (LY)'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/00283924
            'TSMLYEA1S00733684' => ['TSMLYEA1S00733684', 'Suzuki', ['Vitara (LY)'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/00064581
            'TSMLYD21S00305983' => ['TSMLYD21S00305983', 'Suzuki', ['Vitara (LY)'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/60609460
            'TSMMHY51S00301712' => ['TSMMHY51S00301712', 'Suzuki', ['Ignis I'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/60609460
            'TSMMZC11S00115297' => ['TSMMZC11S00115297', 'Suzuki', ['Swift IV'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/60609460
            'JSAFJB43V00604193' => ['JSAFJB43V00604193', 'Suzuki', ['Jimny (FJ)'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/00283924
            'JSAJTD54V00134847' => ['JSAJTD54V00134847', 'Suzuki', ['Grand Vitara II'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/00283924
            'JSAJTD44V00505004' => ['JSAJTD44V00505004', 'Suzuki', ['Grand Vitara II'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/60609460
            'JSAFTB03V00203083' => ['JSAFTB03V00203083', 'Suzuki', ['Grand Vitara I'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/42196451
            'JMZBA14P201178261' => ['JMZBA14P201178261', 'Mazda', ['323 (BA)'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/00064581
            'JMZBA123200355733' => ['JMZBA123200355733', 'Mazda', ['323 (BA)'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/00064581
            'JMZGE14F201287392' => ['JMZGE14F201287392', 'Mazda', ['626 (GE)'], false], // https://www.hlidacstatu.cz/subjekt/vozovyparklist/00064581
            'JM1BM1U73G1320914' => ['JM1BM1U73G1320914', 'Mazda', ['3 (BM)'], false], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/JM1BM1U73G1320914?format
            '3MZBN1M34JM174590' => ['3MZBN1M34JM174590', 'Mazda', ['3 (BM)'], false], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/3MZBN1M34JM174590?format
            'JM1GJ1U56G1448187' => ['JM1GJ1U56G1448187', 'Mazda', ['6 (GJ)'], false], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/JM1GJ1U56G1448187?format
            'JM1GL1UM1J1325700' => ['JM1GL1UM1J1325700', 'Mazda', ['6 (GJ)'], false], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/JM1GL1UM1J1325700?format
            'JM3KFBDM6K0671960' => ['JM3KFBDM6K0671960', 'Mazda', ['CX-5 (KF)'], false], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/JM3KFBDM6K0671960?format
            'JM1NDAM7XK0302874' => ['JM1NDAM7XK0302874', 'Mazda', ['MX-5 (ND)'], false], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/JM1NDAM7XK0302874?format
            'SHHFK2790FU700255' => ['SHHFK2790FU700255', 'Honda', ['Civic IX'], false], // https://fastcarcheck.uk/vin-check/SHHFK2790FU700255
            'SHHFK28608U045487' => ['SHHFK28608U045487', 'Honda', ['Civic VIII'], false], // https://fastcarcheck.uk/vin-check/SHHFK28608U045487
            'SHHFK6760JU011670' => ['SHHFK6760JU011670', 'Honda', ['Civic X'], false], // https://fastcarcheck.uk/vin-check/SHHFK6760JU011670
            'NLAFD75509W000001' => ['NLAFD75509W000001', 'Honda', ['Civic VIII'], false], // https://uokik.gov.pl/download.php?plik=19193
            'SHSRE58709U000218' => ['SHSRE58709U000218', 'Honda', ['CR-V III'], false], // https://uokik.gov.pl/download.php?plik=19193
            'JHMGE67809S225438' => ['JHMGE67809S225438', 'Honda', ['Jazz II'], false], // https://uokik.gov.pl/download.php?plik=19193
            'LUCGG274093209493' => ['LUCGG274093209493', 'Honda', ['Jazz II'], false], // https://uokik.gov.pl/download.php?plik=19193
            'JHMCW18009C204489' => ['JHMCW18009C204489', 'Honda', ['Accord VIII'], false], // https://uokik.gov.pl/download.php?plik=19193
            'JHMCU15009C223474' => ['JHMCU15009C223474', 'Honda', ['Accord VIII'], false], // https://uokik.gov.pl/download.php?plik=19193
            'JHMGK3730GX230476' => ['JHMGK3730GX230476', 'Honda', ['Jazz III'], false], // https://carsbat.com/en/detail/jhmgk3730gx230476-kmc3s1
            'JHMGR6870NS202950' => ['JHMGR6870NS202950', 'Honda', ['Jazz IV'], false], // https://carsbat.com/de/detail/jhmgr6870ns202950-22tb5g/
            'JHMRV5880NS208886' => ['JHMRV5880NS208886', 'Honda', ['HR-V III'], false], // https://carsbat.com/de/detail/jhmrv5880ns208886-tecv3g/
            'JHMRW1740KX204455' => ['JHMRW1740KX204455', 'Honda', ['CR-V V'], false], // https://fastcarcheck.uk/vin-check/JHMRW1740KX204455
            'SJNFCAJ11U1307257' => ['SJNFCAJ11U1307257', 'Nissan', ['Qashqai J11'], false], // https://uokik.gov.pl/download.php?plik=18174
            'SJNFAAJ11U2775289' => ['SJNFAAJ11U2775289', 'Nissan', ['Qashqai J11'], false], // https://carsbat.com/de/detail/sjnfaaj11u2775289-vvdvxg/
            'SJNTAAJ12U1041376' => ['SJNTAAJ12U1041376', 'Nissan', ['Qashqai J12'], false], // https://carsbat.com/de/detail/sjntaaj12u1041376-vxbdos/
            'SJNFAAF15U7100024' => ['SJNFAAF15U7100024', 'Nissan', ['Juke F15'], false], // https://uokik.gov.pl/download.php?plik=18174
            'SJNFAAF16U1149038' => ['SJNFAAF16U1149038', 'Nissan', ['Juke F16'], false], // https://carsbat.com/de/detail/sjnfaaf16u1149038-6lrtdv/
            'SJNFAAE11U2053436' => ['SJNFAAE11U2053436', 'Nissan', ['Note E11'], false], // https://uokik.gov.pl/download.php?plik=17372
            'VSKDCAC13U0049950' => ['VSKDCAC13U0049950', 'Nissan', ['Pulsar C13'], false], // https://uokik.gov.pl/download.php?plik=18174
            'SJNBAAN16U0425735' => ['SJNBAAN16U0425735', 'Nissan', ['Almera N16'], false], // https://uokik.gov.pl/download.php?plik=21661
            'JN1TGAT32U0074796' => ['JN1TGAT32U0074796', 'Nissan', ['X-Trail T32'], false], // https://carsbat.com/de/detail/jn1tgat32u0074796-lrwssm/
            'JN1TBNT30U0008699' => ['JN1TBNT30U0008699', 'Nissan', ['X-Trail T30'], false], // https://carsbat.com/de/detail/jn1tbnt30u0008699-qvwggn/
            'JN1T33TA4U0011747' => ['JN1T33TA4U0011747', 'Nissan', ['X-Trail T33'], false], // https://carsbat.com/de/detail/jn1t33ta4u0011747-c8i4li/
            'VNVK1400470065922' => ['VNVK1400470065922', 'Nissan', ['Micra K14'], false], // https://carsbat.com/de/detail/vnvk1400470065922-ic1xu2/
            'VSKCTND23U0117664' => ['VSKCTND23U0117664', 'Nissan', ['Navara D23'], false], // https://carsbat.com/de/detail/vskctnd23u0117664-0mervc/
            'VSKCAND40U0553432' => ['VSKCAND40U0553432', 'Nissan', ['Navara D40'], false], // https://carsbat.com/de/detail/vskcand40u0553432-ks3ugx/
            'SJNFAAZE1U0087758' => ['SJNFAAZE1U0087758', 'Nissan', ['Leaf ZE1'], false], // https://carsbat.com/de/detail/sjnfaaze1u0087758-fgw1u7/
            'SJKDAAH15U1000070' => ['SJKDAAH15U1000070', 'Infiniti', ['Q30', 'QX30'], false], // https://uokik.gov.pl/download.php?plik=20994
            'SJKDBNH15U1000999' => ['SJKDBNH15U1000999', 'Infiniti', ['Q30', 'QX30'], false], // https://uokik.gov.pl/download.php?plik=20994
            'JNKCV61E29M300882' => ['JNKCV61E29M300882', 'Infiniti', ['G37 (V36)'], false], // https://forcar.org/vin-check/JNKCV61E29M300882/
            'JNKCV61F69M360589' => ['JNKCV61F69M360589', 'Infiniti', ['G37 (V36)'], false], // https://stat.vin/vin-decoding/infiniti/g37/JNKCV61F69M360589
            'JMBXTGF7WKZ008081' => ['JMBXTGF7WKZ008081', 'Mitsubishi', ['Outlander III'], false], // https://carsbat.com/de/detail/jmbxtgf7wkz008081-s7osav/
            'JMBXDGG2WEZ018114' => ['JMBXDGG2WEZ018114', 'Mitsubishi', ['Outlander III'], false], // https://carsbat.com/de/detail/jmbxdgg2wez018114-s2dvve/
            'JMBXDGG3WLZ026886' => ['JMBXDGG3WLZ026886', 'Mitsubishi', ['Outlander III'], false], // https://carsbat.com/de/detail/jmbxdgg3wlz026886-qtskjw/
            'JMBXJCW8W9F000061' => ['JMBXJCW8W9F000061', 'Mitsubishi', ['Outlander II'], false], // https://uokik.gov.pl/download.php?plik=16920
            'JMBSNCY3AAU000201' => ['JMBSNCY3AAU000201', 'Mitsubishi', ['Lancer X'], false], // https://uokik.gov.pl/download.php?plik=16920
            'JMBLNCX3AAU000201' => ['JMBLNCX3AAU000201', 'Mitsubishi', ['Lancer X'], false], // https://uokik.gov.pl/download.php?plik=16920
            'JMBXNGA1WBZ000754' => ['JMBXNGA1WBZ000754', 'Mitsubishi', ['ASX I'], false], // https://uokik.gov.pl/download.php?plik=22416
            'JMBLYV98W7J000133' => ['JMBLYV98W7J000133', 'Mitsubishi', ['Pajero IV'], false], // https://uokik.gov.pl/download.php?plik=20354
            'JF1BL5LJ34G002022' => ['JF1BL5LJ34G002022', 'Subaru', ['Legacy IV'], false], // https://uokik.gov.pl/download.php?plik=19958
            'JF1BP5LK44G002102' => ['JF1BP5LK44G002102', 'Subaru', ['Legacy IV', 'Outback III'], false], // https://uokik.gov.pl/download.php?plik=19958
            'JF1GD9LJ34G054396' => ['JF1GD9LJ34G054396', 'Subaru', ['Impreza II'], false], // https://uokik.gov.pl/download.php?plik=16645
            'JF1GG9LK44G025488' => ['JF1GG9LK44G025488', 'Subaru', ['Impreza II'], false], // https://uokik.gov.pl/download.php?plik=16645
            '4S4WXELU57S002046' => ['4S4WXELU57S002046', 'Subaru', ['Tribeca'], false], // https://uokik.gov.pl/download.php?plik=19958
            'JF2SJAEC8HH547580' => ['JF2SJAEC8HH547580', 'Subaru', ['Forester SJ'], false], // https://www.dealerrater.com/classifieds/2017-Subaru-Forester-ad-JF2SJAEC8HH54758
            'JF2SKAGC1KH501591' => ['JF2SKAGC1KH501591', 'Subaru', ['Forester SK'], false], // https://www.dealerrater.com/classifieds/2019-Subaru-Forester-ad-JF2SKAGC1KH50159
            'W0L0AHL3592133280' => ['W0L0AHL3592133280', 'Opel', ['Astra H'], 2009], // https://www.hlidacstatu.cz/vozidla/vin/W0L0AHL3592133280
            'W0L0AHL0885159409' => ['W0L0AHL0885159409', 'Opel', ['Astra H'], 2008], // https://carsbat.com/en/detail/w0l0ahl0885159409-dlithd/
            'W0L0AHM75AG016972' => ['W0L0AHM75AG016972', 'Opel', ['Zafira B'], 2010], // https://carsbat.com/en/detail/w0l0ahm75ag016972-psvw3f/
            'W0L0SDL68B4122941' => ['W0L0SDL68B4122941', 'Opel', ['Corsa D'], 2011], // https://carsbat.com/en/detail/w0l0sdl68b4122941-sxpww9/
            'W0L0XEP68H4094844' => ['W0L0XEP68H4094844', 'Opel', ['Corsa E'], 2017], // https://carsbat.com/en/detail/w0l0xep68h4094844-uiloof/
            'W0V0XEP68J4060536' => ['W0V0XEP68J4060536', 'Opel', ['Corsa E'], 2018], // https://www.hlidacstatu.cz/vozidla/vin/W0V0XEP68J4060536
            'W0L0XCF0826113009' => ['W0L0XCF0826113009', 'Opel', ['Corsa C', 'Combo C'], 2002], // https://carsbat.com/en/detail/w0l0xcf0826113009-v61nqs/
            'W0L0XCF06B4074963' => ['W0L0XCF06B4074963', 'Opel', ['Combo C'], 2011], // https://www.hlidacstatu.cz/vozidla/vin/W0L0XCF06B4074963
            'W0L0XCE7544351633' => ['W0L0XCE7544351633', 'Opel', ['Meriva A'], 2004], // https://www.hlidacstatu.cz/vozidla/vin/W0L0XCE7544351633
            'W0L0TGF48X2205742' => ['W0L0TGF48X2205742', 'Opel', ['Astra G'], 1999], // https://www.hlidacstatu.cz/vozidla/vin/W0L0TGF48X2205742
            'W0L0TGF7512192050' => ['W0L0TGF7512192050', 'Opel', ['Zafira A'], 2001], // https://www.hlidacstatu.cz/vozidla/vin/W0L0TGF7512192050
            'W0L0JBF19W1009527' => ['W0L0JBF19W1009527', 'Opel', ['Vectra B'], 1998], // https://www.hlidacstatu.cz/vozidla/vin/W0L0JBF19W1009527
            'W0LPD8EU3B8126787' => ['W0LPD8EU3B8126787', 'Opel', ['Astra J'], 2011], // https://www.hlidacstatu.cz/vozidla/vin/W0LPD8EU3B8126787
            'W0LPD6EUXE1087133' => ['W0LPD6EUXE1087133', 'Opel', ['Astra J'], 2014], // https://carsbat.com/en/detail/w0lpd6euxe1087133-k4csru/
            'W0LPC9EU3F1074634' => ['W0LPC9EU3F1074634', 'Opel', ['Zafira C Tourer'], 2015], // https://www.hlidacstatu.cz/vozidla/vin/W0LPC9EU3F1074634
            'W0VPE9EE0J1052223' => ['W0VPE9EE0J1052223', 'Opel', ['Zafira C Tourer'], 2018], // https://www.hlidacstatu.cz/vozidla/vin/W0VPE9EE0J1052223
            'W0LPD9EM2F1052931' => ['W0LPD9EM2F1052931', 'Opel', ['Zafira C Tourer'], 2015], // https://carsbat.com/en/detail/w0lpd9em2f1052931-emqlmn/
            'W0LBE8EG6G8086648' => ['W0LBE8EG6G8086648', 'Opel', ['Astra K'], 2016], // https://carsbat.com/en/detail/w0lbe8eg6g8086648-d1d7rk/
            'W0LBF6EC6HG123545' => ['W0LBF6EC6HG123545', 'Opel', ['Astra K'], 2017], // https://carsbat.com/en/detail/w0lbf6ec6hg123545-igaxob/
            'W0VBD6EB3JG054210' => ['W0VBD6EB3JG054210', 'Opel', ['Astra K'], 2018], // https://www.hlidacstatu.cz/vozidla/vin/W0VBD6EB3JG054210
            'W0LGS8EM3E1107112' => ['W0LGS8EM3E1107112', 'Opel', ['Insignia A'], 2014], // https://carsbat.com/de/detail/w0lgs8em3e1107112-6gzwro/
            'W0LGM5GP7E1108201' => ['W0LGM5GP7E1108201', 'Opel', ['Insignia A'], 2014], // https://carsbat.com/de/detail/w0lgm5gp7e1108201-wvrrne/
            'W0VZT8EH6K1067717' => ['W0VZT8EH6K1067717', 'Opel', ['Insignia B'], 2019], // https://www.hlidacstatu.cz/vozidla/vin/W0VZT8EH6K1067717
            'W0VZT6EH4J1109692' => ['W0VZT6EH4J1109692', 'Opel', ['Insignia B'], 2018], // https://carsbat.com/en/detail/w0vzt6eh4j1109692-ywzvbo/
            'W0LJD7E87EB677816' => ['W0LJD7E87EB677816', 'Opel', ['Mokka'], 2014], // https://carsbat.com/pl/detail/w0ljd7e87eb677816-vxaafr/
            'W0VJD7E86JB530792' => ['W0VJD7E86JB530792', 'Opel', ['Mokka'], 2018], // https://carsbat.com/en/detail/w0vjd7e86jb530792-cwk52t/
            'W0LSH9EN3G4030914' => ['W0LSH9EN3G4030914', 'Opel', ['Meriva B'], 2016], // https://carsbat.com/en/detail/w0lsh9en3g4030914-kqolzz/
            'W0L7H9EEXH4261798' => ['W0L7H9EEXH4261798', 'Opel', ['Crossland'], 2017], // https://www.hlidacstatu.cz/vozidla/vin/W0L7H9EEXH4261798
            'W0V7D9ED4K4040960' => ['W0V7D9ED4K4040960', 'Opel', ['Crossland'], 2019], // https://www.hlidacstatu.cz/vozidla/vin/W0V7D9ED4K4040960
            'W0VZCYHZ8L6039085' => ['W0VZCYHZ8L6039085', 'Opel', ['Grandland'], 2020], // https://carsbat.com/detail/w0vzcyhz8l6039085-puwix1/
            'W0VZRHNS4L6006073' => ['W0VZRHNS4L6006073', 'Opel', ['Grandland'], 2020], // https://carsbat.com/en/detail/w0vzrhns4l6006073-gzibx2/
            'VXKUPHMHDM4287553' => ['VXKUPHMHDM4287553', 'Opel', ['Corsa F'], 2021], // https://carsbat.com/en/detail/vxkuphmhdm4287553-2tzikg/
            'VXKUPHNEKN4383451' => ['VXKUPHNEKN4383451', 'Opel', ['Corsa F'], 2022], // https://www.hlidacstatu.cz/vozidla/vin/VXKUPHNEKN4383451
            'VXKUSHNSSNW060731' => ['VXKUSHNSSNW060731', 'Opel', ['Mokka B'], 2022], // https://carsbat.com/detail/vxkushnssnw060731-5wbluk/
            'VXKUKZKXZNW051539' => ['VXKUKZKXZNW051539', 'Opel', ['Mokka B'], 2022], // https://carsbat.com/en/detail/vxkukzkxznw051539-nqoksy/
            'VXKFPHNSTP1013171' => ['VXKFPHNSTP1013171', 'Opel', ['Astra L'], 2023], // https://www.hlidacstatu.cz/vozidla/vin/VXKFPHNSTP1013171
            'VXKFPHNPLP1006509' => ['VXKFPHNPLP1006509', 'Opel', ['Astra L'], 2023], // https://carsbat.com/fr/detail/vxkfphnplp1006509-uyagqg/
            'W0VEFYHT2NJ689873' => ['W0VEFYHT2NJ689873', 'Opel', ['Combo E'], 2022], // https://www.hlidacstatu.cz/vozidla/vin/W0VEFYHT2NJ689873
            'W0VEZZKXZPJ878624' => ['W0VEZZKXZPJ878624', 'Opel', ['Combo E'], 2023], // https://www.hlidacstatu.cz/vozidla/vin/W0VEZZKXZPJ878624
            'W0L6VZA1AH9595740' => ['W0L6VZA1AH9595740', 'Opel', ['Combo D'], 2017], // https://www.hlidacstatu.cz/vozidla/vin/W0L6VZA1AH9595740
            'W0LJ7AMA68V662937' => ['W0LJ7AMA68V662937', 'Opel', ['Vivaro A'], 2008], // https://www.hlidacstatu.cz/vozidla/vin/W0LJ7AMA68V662937
            'W0LJ7D604HV650820' => ['W0LJ7D604HV650820', 'Opel', ['Vivaro B'], 2017], // https://www.hlidacstatu.cz/vozidla/vin/W0LJ7D604HV650820
            'W0VF7G603KV622030' => ['W0VF7G603KV622030', 'Opel', ['Vivaro B'], 2019], // https://carsbat.com/de/detail/w0vf7g603kv622030-a9l3k8/
            'VXEVFAHKKMZ084398' => ['VXEVFAHKKMZ084398', 'Opel', ['Vivaro C'], 2021], // https://www.hlidacstatu.cz/vozidla/vin/VXEVFAHKKMZ084398
            'VXEVZZKXZPZ019340' => ['VXEVZZKXZPZ019340', 'Opel', ['Vivaro C', 'Zafira Life'], 2023], // https://www.hlidacstatu.cz/vozidla/vin/VXEVZZKXZPZ019340
            'W0LMSH4S2GB110606' => ['W0LMSH4S2GB110606', 'Opel', ['Movano B'], 2016], // https://www.hlidacstatu.cz/vozidla/vin/W0LMSH4S2GB110606
            'W0VVS160XKB167878' => ['W0VVS160XKB167878', 'Opel', ['Movano B'], 2019], // https://www.hlidacstatu.cz/vozidla/vin/W0VVS160XKB167878
            'VXEYBBPFB12X22404' => ['VXEYBBPFB12X22404', 'Opel', ['Movano C'], null], // https://www.hlidacstatu.cz/vozidla/vin/VXEYBBPFB12X22404
            'ZFA18800004827940' => ['ZFA18800004827940', 'Fiat', ['Punto II'], null], // https://www.hlidacstatu.cz/vozidla/vin/ZFA18800004827940
            'ZFA19900001272532' => ['ZFA19900001272532', 'Fiat', ['Punto III (Grande/Evo)'], null], // https://www.hlidacstatu.cz/vozidla/vin/ZFA19900001272532
            'ZFA1990000P102549' => ['ZFA1990000P102549', 'Fiat', ['Punto III (Grande/Evo)'], null], // https://www.hlidacstatu.cz/vozidla/vin/ZFA1990000P102549
            'ZFA19900005486357' => ['ZFA19900005486357', 'Fiat', ['500L'], null], // https://carsbat.com/en/detail/zfa19900005486357-suoqnt/
            'ZFA31200003155560' => ['ZFA31200003155560', 'Fiat', ['Panda III'], null], // https://carsbat.com/en/detail/zfa31200003155560-mxwaja/
            'ZFA31200003B02663' => ['ZFA31200003B02663', 'Fiat', ['Panda III'], null], // https://carsbat.com/en/detail/zfa31200003b02663-5n0fur/
            'ZFA3120000JC86440' => ['ZFA3120000JC86440', 'Fiat', ['500'], null], // https://carsbat.com/en/detail/zfa3120000jc86440-bx3ht7/
            'ZFACF1BJ2NJH21486' => ['ZFACF1BJ2NJH21486', 'Fiat', ['500'], 2022], // https://carsbat.com/en/detail/zfacf1bj2njh21486-n5fx7z/
            'ZFACF7DSXM6T73704' => ['ZFACF7DSXM6T73704', 'Fiat', ['Tipo'], 2021], // https://carsbat.com/en/detail/zfacf7dsxm6t73704-0hiiie/
            'ZFA3340000P779054' => ['ZFA3340000P779054', 'Fiat', ['500X'], null], // https://carsbat.com/en/detail/zfa3340000p779054-d5ywvg/
            'ZFA19800004381874' => ['ZFA19800004381874', 'Fiat', ['Bravo II'], null], // https://carsbat.com/en/detail/zfa19800004381874-ulcmvh/
            'ZFA16900000257361' => ['ZFA16900000257361', 'Fiat', ['Panda II'], null], // https://www.hlidacstatu.cz/vozidla/vin/ZFA16900000257361
            'ZFA22300005602842' => ['ZFA22300005602842', 'Fiat', ['Doblo I'], null], // https://www.hlidacstatu.cz/vozidla/vin/ZFA22300005602842
            'ZFA26300006139761' => ['ZFA26300006139761', 'Fiat', ['Doblo II'], null], // https://www.hlidacstatu.cz/vozidla/vin/ZFA26300006139761
            'ZFA26300006G77078' => ['ZFA26300006G77078', 'Fiat', ['Doblo II'], null], // https://carsbat.com/en/detail/zfa26300006g77078-jvttay/
            'ZFA22500000183196' => ['ZFA22500000183196', 'Fiat', ['Fiorino/Qubo'], null], // https://www.hlidacstatu.cz/vozidla/vin/ZFA22500000183196
            'ZFA23000005373440' => ['ZFA23000005373440', 'Fiat', ['Ducato II'], null], // https://www.hlidacstatu.cz/vozidla/vin/ZFA23000005373440
            'ZFA24400007159266' => ['ZFA24400007159266', 'Fiat', ['Ducato II'], null], // https://www.hlidacstatu.cz/vozidla/vin/ZFA24400007159266
            'ZFA25000002004052' => ['ZFA25000002004052', 'Fiat', ['Ducato III'], null], // https://www.hlidacstatu.cz/vozidla/vin/ZFA25000002004052
            'ZFA25000002P35485' => ['ZFA25000002P35485', 'Fiat', ['Ducato III'], null], // https://carsbat.com/pl/detail/zfa25000002p35485-2yhca5/
            'ZFA250001SMA68758' => ['ZFA250001SMA68758', 'Fiat', ['Ducato III'], 2025], // https://www.hlidacstatu.cz/vozidla/vin/ZFA250001SMA68758
            'ZFA27000064128751' => ['ZFA27000064128751', 'Fiat', ['Scudo II'], null], // https://www.hlidacstatu.cz/vozidla/vin/ZFA27000064128751
            'ZFAFJL001G5028354' => ['ZFAFJL001G5028354', 'Fiat', ['Talento'], 2016], // https://www.hlidacstatu.cz/vozidla/vin/ZFAFJL001G5028354
            'ZFA18200004574048' => ['ZFA18200004574048', 'Fiat', ['Bravo/Brava'], null], // https://www.hlidacstatu.cz/vozidla/vin/ZFA18200004574048
            'ZARFAMEV3L7634732' => ['ZARFAMEV3L7634732', 'Alfa Romeo', ['Giulia'], 2020], // https://carsbat.com/en/detail/zarfamev3l7634732-dam79l/
            'ZARFANAN1K7607233' => ['ZARFANAN1K7607233', 'Alfa Romeo', ['Giulia'], 2019], // https://carsbat.com/en/detail/zarfanan1k7607233-58ic9m/
            'ZAREAEGN3L7640173' => ['ZAREAEGN3L7640173', 'Alfa Romeo', ['Giulia'], 2020], // https://carsbat.com/en/detail/zareaegn3l7640173-mr75hi/
            'ZARPAHBN4M7D30202' => ['ZARPAHBN4M7D30202', 'Alfa Romeo', ['Stelvio'], 2021], // https://carsbat.com/en/detail/zarpahbn4m7d30202-td5axx/
            'ZARPAHDN1P7D77219' => ['ZARPAHDN1P7D77219', 'Alfa Romeo', ['Stelvio'], 2023], // https://carsbat.com/en/detail/zarpahdn1p7d77219-yjysug/
            'ZARPAHDN6M7D10112' => ['ZARPAHDN6M7D10112', 'Alfa Romeo', ['Stelvio'], 2021], // https://carsbat.com/en/detail/zarpahdn6m7d10112-07l2pg/
            'ZAR94000007498914' => ['ZAR94000007498914', 'Alfa Romeo', ['Giulietta'], null], // https://carsbat.com/en/detail/zar94000007498914-1pybqi/
            'ZAR94000007543191' => ['ZAR94000007543191', 'Alfa Romeo', ['Giulietta'], null], // https://carsbat.com/en/detail/zar94000007543191-iwhobc/
            'ZAR16400006278334' => ['ZAR16400006278334', 'Alfa Romeo', [], null], // https://www.hlidacstatu.cz/vozidla/vin/ZAR16400006278334
            '1C4BU0000KPK40826' => ['1C4BU0000KPK40826', 'Jeep', ['Renegade'], 2019], // https://carsbat.com/en/detail/1c4bu0000kpk40826-fonhrq/
            '1C4BU0000FPB15001' => ['1C4BU0000FPB15001', 'Jeep', ['Renegade'], 2015], // https://carsbat.com/en/detail/1c4bu0000fpb15001-934coz/
            '1C4RJFBG5MC775433' => ['1C4RJFBG5MC775433', 'Jeep', ['Grand Cherokee WK2'], 2021], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/1C4RJFBG5MC775433?format
            '1C4RJFBM1DC606192' => ['1C4RJFBM1DC606192', 'Jeep', ['Grand Cherokee WK2'], 2013], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/1C4RJFBM1DC606192?format
            '1C4RJHAGXRC211278' => ['1C4RJHAGXRC211278', 'Jeep', ['Grand Cherokee WL'], 2024], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/1C4RJHAGXRC211278?format
            '1C4PJMCXXJD597518' => ['1C4PJMCXXJD597518', 'Jeep', ['Cherokee KL'], 2018], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/1C4PJMCXXJD597518?format
            '1C4PJXFN3RW250284' => ['1C4PJXFN3RW250284', 'Jeep', ['Wrangler JL'], 2024], // https://www.hlidacstatu.cz/vozidla/vin/1C4PJXFN3RW250284
            '1J4GR48K46C220552' => ['1J4GR48K46C220552', 'Jeep', ['Grand Cherokee WK'], 2006], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/1J4GR48K46C220552?format
            '1J4FJ68S7RL118178' => ['1J4FJ68S7RL118178', 'Jeep', ['Cherokee XJ'], 2024], // https://www.hlidacstatu.cz/vozidla/vin/1J4FJ68S7RL118178
            '1C4RDJDG1KC536823' => ['1C4RDJDG1KC536823', 'Dodge', ['Durango III'], 2019], // https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/1C4RDJDG1KC536823?format
            'ZLA83400000068973' => ['ZLA83400000068973', 'Lancia', [], null], // https://www.hlidacstatu.cz/vozidla/vin/ZLA83400000068973
            'ZLA83500000034429' => ['ZLA83500000034429', 'Lancia', [], null], // https://www.hlidacstatu.cz/vozidla/vin/ZLA83500000034429
            'VF3LJAHXHHS225088' => ['VF3LJAHXHHS225088', 'Peugeot', ['308 II'], 2017], // https://www.hlidacstatu.cz/vozidla/vin/VF3LJAHXHHS225088
            'VF3LBBHZHGS153544' => ['VF3LBBHZHGS153544', 'Peugeot', ['308 II'], 2016], // https://www.hlidacstatu.cz/vozidla/vin/VF3LBBHZHGS153544
            'VF3LPHNSJMS052471' => ['VF3LPHNSJMS052471', 'Peugeot', ['308 II'], 2021], // https://www.hlidacstatu.cz/vozidla/vin/VF3LPHNSJMS052471
            'VF3WC8HR0BT031410' => ['VF3WC8HR0BT031410', 'Peugeot', ['207'], 2011], // https://www.hlidacstatu.cz/vozidla/vin/VF3WC8HR0BT031410
            'VF3XC9HUCBZ061940' => ['VF3XC9HUCBZ061940', 'Peugeot', ['Expert II'], 2011], // https://www.hlidacstatu.cz/vozidla/vin/VF3XC9HUCBZ061940
            'VF3VEAHXKJZ129568' => ['VF3VEAHXKJZ129568', 'Peugeot', ['Expert III', 'Traveller'], 2018], // https://www.hlidacstatu.cz/vozidla/vin/VF3VEAHXKJZ129568
            'VF3YCUMFC12398008' => ['VF3YCUMFC12398008', 'Peugeot', ['Boxer'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF3YCUMFC12398008
            'VF3GBKFWB96094017' => ['VF3GBKFWB96094017', 'Peugeot', ['Partner I'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF3GBKFWB96094017
            'VF37J9HZC9J155812' => ['VF37J9HZC9J155812', 'Peugeot', ['Partner'], 2009], // https://www.hlidacstatu.cz/vozidla/vin/VF37J9HZC9J155812
            'VF3CUHMZ0DY074967' => ['VF3CUHMZ0DY074967', 'Peugeot', ['2008 I'], 2013], // https://carsbat.com/de/detail/vf3cuhmz0dy074967-jqx92b/
            'VF3CUHNP3KY201385' => ['VF3CUHNP3KY201385', 'Peugeot', ['2008 I'], 2019], // https://carsbat.com/de/detail/vf3cuhnp3ky201385-ebijce/
            'VF3PSCFB7LR089895' => ['VF3PSCFB7LR089895', 'Peugeot', ['108'], 2020], // https://carsbat.com/de/detail/vf3pscfb7lr089895-gb3uax/
            'VR3F3DGZTKY218349' => ['VR3F3DGZTKY218349', 'Peugeot', ['508 II'], 2019], // https://carsbat.com/de/detail/vr3f3dgztky218349-hke3bt/
            'VR3FBYHZJLY037858' => ['VR3FBYHZJLY037858', 'Peugeot', ['508 II'], 2020], // https://carsbat.com/de/detail/vr3fbyhzjly037858-resirk/
            'VR3UPHNKSPT658811' => ['VR3UPHNKSPT658811', 'Peugeot', ['208 II'], 2023], // https://carsbat.com/de/detail/vr3uphnkspt658811-hfmg4s/
            'VR3UPHNKSN5930122' => ['VR3UPHNKSN5930122', 'Peugeot', ['208 II'], 2022], // https://carsbat.com/de/detail/vr3uphnksn5930122-m7bk9i/
            'VR3UDYHSKLJ986765' => ['VR3UDYHSKLJ986765', 'Peugeot', ['2008 II'], 2020], // https://carsbat.com/de/detail/vr3udyhsklj986765-580bvm/
            'VF3MRHNSUKL122729' => ['VF3MRHNSUKL122729', 'Peugeot', ['3008 II', '5008 II'], 2019], // https://carsbat.com/de/detail/vf3mrhnsukl122729-ohqrt4/
            'VF7YBUMFB12476400' => ['VF7YBUMFB12476400', 'Citroën', ['Jumper'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF7YBUMFB12476400
            'VR7ERHNP2KJ826335' => ['VR7ERHNP2KJ826335', 'Citroën', ['Berlingo III'], 2019], // https://www.hlidacstatu.cz/vozidla/vin/VR7ERHNP2KJ826335
            'VR7EFYHP2PJ779451' => ['VR7EFYHP2PJ779451', 'Citroën', ['Berlingo III'], 2023], // https://www.hlidacstatu.cz/vozidla/vin/VR7EFYHP2PJ779451
            'VF7AAFHZ0C8251289' => ['VF7AAFHZ0C8251289', 'Citroën', ['Nemo'], 2012], // https://www.hlidacstatu.cz/vozidla/vin/VF7AAFHZ0C8251289
            'VF7BZWJYB86089184' => ['VF7BZWJYB86089184', 'Citroën', ['Jumpy I'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF7BZWJYB86089184
            'VF7GJRHYK93094279' => ['VF7GJRHYK93094279', 'Citroën', ['Berlingo I'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF7GJRHYK93094279
            'VF7CHNFUC9J116299' => ['VF7CHNFUC9J116299', 'Citroën', ['Xsara Picasso'], 2009], // https://www.hlidacstatu.cz/vozidla/vin/VF7CHNFUC9J116299
            'VR7CCHPV4RT168883' => ['VR7CCHPV4RT168883', 'Citroën', ['C3 IV'], 2024], // https://www.hlidacstatu.cz/vozidla/vin/VR7CCHPV4RT168883
            'VF7SXHMRVMT535065' => ['VF7SXHMRVMT535065', 'Citroën', ['C3 III'], 2021], // https://carsbat.com/de/detail/vf7sxhmrvmt535065-qncvqn/
            'VF7SXHMRVRT030469' => ['VF7SXHMRVRT030469', 'Citroën', ['C3 III'], 2024], // https://carsbat.com/de/detail/vf7sxhmrvrt030469-zidxzn/
            'VF72RHNPMP4271634' => ['VF72RHNPMP4271634', 'Citroën', ['C3 Aircross I'], 2023], // https://carsbat.com/de/detail/vf72rhnpmp4271634-yjv5zg/
            'VR7A4DGZSNL017515' => ['VR7A4DGZSNL017515', 'Citroën', ['C5 Aircross I'], 2022], // https://carsbat.com/de/detail/vr7a4dgzsnl017515-g4euai/
            'VR7BBYHZBNE011354' => ['VR7BBYHZBNE011354', 'Citroën', ['C4 III'], 2022], // https://carsbat.com/de/detail/vr7bbyhzbne011354-nplur9/
            'VR7BCZKXCNE011415' => ['VR7BCZKXCNE011415', 'Citroën', ['C4 III'], 2022], // https://carsbat.com/de/detail/vr7bczkxcne011415-tbo0ub/
            'VF73AYHZ4NJ588034' => ['VF73AYHZ4NJ588034', 'Citroën', ['C4 Picasso II'], 2022], // https://carsbat.com/de/detail/vf73ayhz4nj588034-bc3nig/
            'VF70PHNZBHE502044' => ['VF70PHNZBHE502044', 'Citroën', ['C4 Cactus'], 2017], // https://carsbat.com/de/detail/vf70phnzbhe502044-lqalyg/
            'VR1JCYHZJKY222519' => ['VR1JCYHZJKY222519', 'DS', ['DS 7 Crossback'], 2019], // https://carsbat.com/de/detail/vr1jcyhzjky222519-awpksg/
            'VR1J45GBUMY524773' => ['VR1J45GBUMY524773', 'DS', ['DS 7 Crossback'], 2021], // https://carsbat.com/de/detail/vr1j45gbumy524773-w21pne/
            'VR1JRHNSULY033481' => ['VR1JRHNSULY033481', 'DS', ['DS 7 Crossback'], 2020], // https://carsbat.com/de/detail/vr1jrhnsuly033481-rogxum/
            'VF7SA5FS9AW545475' => ['VF7SA5FS9AW545475', 'DS', ['DS 3'], 2010], // https://carsbat.com/de/detail/vf7sa5fs9aw545475-yc40l4/
            'VF7SAHNZ6HW526807' => ['VF7SAHNZ6HW526807', 'DS', ['DS 3'], 2017], // https://carsbat.com/de/detail/vf7sahnz6hw526807-df3gpf/
            'VR1F4DGYTN1045782' => ['VR1F4DGYTN1045782', 'DS', ['DS 4 II'], 2022], // https://carsbat.com/de/detail/vr1f4dgytn1045782-thguxw/
            'VF1RJA00269988556' => ['VF1RJA00269988556', 'Renault', ['Clio V'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1RJA00269988556
            'VF1RJB00864732053' => ['VF1RJB00864732053', 'Renault', ['Captur II'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1RJB00864732053
            'VF1RJK00669000300' => ['VF1RJK00669000300', 'Renault', ['Express'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1RJK00669000300
            'VF1RFK00873673448' => ['VF1RFK00873673448', 'Renault', ['Kangoo III'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1RFK00873673448
            'VF1AG000865015856' => ['VF1AG000865015856', 'Renault', ['Zoe'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1AG000865015856
            'VF1KW0UB546402487' => ['VF1KW0UB546402487', 'Renault', ['Kangoo II'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1KW0UB546402487
            'VF1KC1DBF34973606' => ['VF1KC1DBF34973606', 'Renault', ['Kangoo I'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1KC1DBF34973606
            'VF1BR140H46470292' => ['VF1BR140H46470292', 'Renault', ['Clio III'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1BR140H46470292
            'VF1JL000074054380' => ['VF1JL000074054380', 'Renault', ['Trafic III'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1JL000074054380
            'VF1JLBHB68Y267134' => ['VF1JLBHB68Y267134', 'Renault', ['Trafic II'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1JLBHB68Y267134
            'VF1MA000967731717' => ['VF1MA000967731717', 'Renault', ['Master III'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1MA000967731717
            'VF1VB000160704215' => ['VF1VB000160704215', 'Renault', ['Master III'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1VB000160704215
            'VF1FDAKD532849367' => ['VF1FDAKD532849367', 'Renault', ['Master II'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1FDAKD532849367
            'VF6MF000462618542' => ['VF6MF000462618542', 'Renault', ['Master III'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF6MF000462618542
            'VF8JE0A0516970805' => ['VF8JE0A0516970805', 'Renault', ['Espace III'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF8JE0A0516970805
            'VF1RFE00565461806' => ['VF1RFE00565461806', 'Renault', ['Kadjar'], null], // https://carsbat.com/de/detail/vf1rfe00565461806-p0okfz/
            'VF1RFB00763250195' => ['VF1RFB00763250195', 'Renault', ['Megane IV'], null], // https://carsbat.com/de/detail/vf1rfb00763250195-6kk4lf/
            'VF1RHN00472768929' => ['VF1RHN00472768929', 'Renault', ['Austral'], null], // https://carsbat.com/de/detail/vf1rhn00472768929-wesrkh/
            'VF1RJL003UC321197' => ['VF1RJL003UC321197', 'Renault', ['Arkana'], null], // https://carsbat.com/de/detail/vf1rjl003uc321197-j9piiz/
            'VF12RA11A57132999' => ['VF12RA11A57132999', 'Renault', ['Captur I'], null], // https://carsbat.com/de/detail/vf12ra11a57132999-xrc0ao/
            'VF1RCB00369735925' => ['VF1RCB00369735925', 'Renault', ['Megane E-Tech', 'Scenic E-Tech'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1RCB00369735925
            'UU1HSDJ9G58660295' => ['UU1HSDJ9G58660295', 'Dacia', ['Duster I'], null], // https://www.hlidacstatu.cz/vozidla/vin/UU1HSDJ9G58660295
            'VF1HJD40461985230' => ['VF1HJD40461985230', 'Dacia', ['Duster II'], null], // https://www.hlidacstatu.cz/vozidla/vin/VF1HJD40461985230
            'UU15SDCH555514197' => ['UU15SDCH555514197', 'Dacia', ['Sandero II'], null], // https://carsbat.com/de/detail/uu15sdch555514197-niaczn/
            'UU15SDGG553134548' => ['UU15SDGG553134548', 'Dacia', ['Sandero II'], null], // https://www.hlidacstatu.cz/vozidla/vin/UU15SDGG553134548
            'UU1JSDDL551708748' => ['UU1JSDDL551708748', 'Dacia', ['Lodgy'], null], // https://www.hlidacstatu.cz/vozidla/vin/UU1JSDDL551708748
            'UU10SDCV557095334' => ['UU10SDCV557095334', 'Dacia', ['Dokker'], null], // https://www.hlidacstatu.cz/vozidla/vin/UU10SDCV557095334
            'UU18SDRV556762606' => ['UU18SDRV556762606', 'Dacia', ['Dokker Van'], null], // https://www.hlidacstatu.cz/vozidla/vin/UU18SDRV556762606
            'UU1KSDA3H46481618' => ['UU1KSDA3H46481618', 'Dacia', ['Logan MCV I'], null], // https://www.hlidacstatu.cz/vozidla/vin/UU1KSDA3H46481618
            'UU1FSD1E542300482' => ['UU1FSD1E542300482', 'Dacia', ['Logan Van'], null], // https://www.hlidacstatu.cz/vozidla/vin/UU1FSD1E542300482
            'UU1DJF00973387866' => ['UU1DJF00973387866', 'Dacia', ['Sandero III', 'Jogger', 'Duster III'], null], // https://www.hlidacstatu.cz/vozidla/vin/UU1DJF00973387866
        ];
    }

    #[DataProvider('realVins')]
    /** @param list<string> $models */
    public function test_real_vin_decodes_to_its_model(string $vin, string $make, array $models, int|false|null $year): void
    {
        $decoded = VinDecoder::decode($vin);

        $this->assertTrue($decoded['valid']);
        $this->assertSame($make, $decoded['make']);
        $this->assertSame($models, $decoded['models']);
        if ($year !== false) {
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
        // Tables the rules use, by the make they answer for.
        $rules = ['KIA_OLD' => 'Kia', 'BMW_OLD' => 'BMW', 'BMW_NEW' => 'BMW', 'MINI_OLD' => 'Mini', 'MINI_NEW' => 'Mini', 'VOLVO_US' => 'Volvo',
            'OPEL_OLD' => 'Opel', 'OPEL_NEW' => 'Opel', 'OPEL_VXE' => 'Opel', 'JEEP_1C4' => 'Jeep', 'JEEP_1J4' => 'Jeep'];
        foreach ($rules as $constant => $make) {
            $tables[$make] = array_merge($tables[$make] ?? [], array_values($constants[$constant]));
        }

        $missing = [];
        foreach ($tables as $make => $codes) {
            array_walk_recursive($codes, function (string $name) use ($make, $catalogue, &$missing): void {
                [$owner, $model] = preg_match('/^(Cupra|Kia|Hyundai|Dacia|DS|Fiat|Dodge):(.+)$/u', $name, $m) ? [$m[1], $m[2]] : [$make, $name];
                if (! in_array($model, $catalogue[$owner] ?? [], true)) {
                    $missing[] = "$owner / $model";
                }
            });
        }
        foreach (self::realVins() as [, $make, $models]) {
            foreach ($models as $model) {
                if (! in_array($model, $catalogue[$make] ?? [], true)) {
                    $missing[] = "$make / $model (test VIN)";
                }
            }
        }

        $this->assertSame([], array_values(array_unique($missing)));
    }
}
