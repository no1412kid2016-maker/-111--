import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Solar, Lunar } from 'https://esm.sh/lunar-javascript@1.6.12';
import { Compass, Clock, MapPin, Info, Calendar as CalendarIcon, RotateCcw, Settings } from 'lucide-react';

// --- Types & Constants ---

type BaziPillar = {
  stem: string;
  branch: string;
  stemElement: string;
  branchElement: string;
  hiddenStems: string[];
};

type BaziResult = {
  year: BaziPillar;
  month: BaziPillar;
  day: BaziPillar;
  hour: BaziPillar;
  solarDate: string;
  lunarDate: string;
  jieQi: {
    prev: { name: string; time: string };
    next: { name: string; time: string };
  };
  solarTime: string; // The calculated true solar time used
  timeDetails: {
    lmtOffset: number; // minutes
    eotOffset: number; // minutes
    totalOffset: number; // minutes
  }
};

const ELEMENT_COLORS: Record<string, string> = {
  '木': 'element-wood',
  '火': 'element-fire',
  '土': 'element-earth',
  '金': 'element-metal',
  '水': 'element-water',
};

const ELEMENT_BG: Record<string, string> = {
  '木': 'bg-element-wood',
  '火': 'bg-element-fire',
  '土': 'bg-element-earth',
  '金': 'bg-element-metal',
  '水': 'bg-element-water',
};

const ZODIAC_MAP: Record<string, string> = {
  '子': '鼠', '丑': '牛', '寅': '虎', '卯': '兔',
  '辰': '龙', '巳': '蛇', '午': '马', '未': '羊',
  '申': '猴', '酉': '鸡', '戌': '狗', '亥': '猪'
};

const CITY_DATA: Record<string, number> = {
  '北京': 116.40, '上海': 121.47, '广州': 113.26, '深圳': 114.05,
  '天津': 117.20, '重庆': 106.55, '沈阳': 123.43, '哈尔滨': 126.53,
  '长春': 125.32, '济南': 117.12, '青岛': 120.38, '南京': 118.79,
  '杭州': 120.15, '宁波': 121.55, '福州': 119.30, '厦门': 118.08,
  '武汉': 114.30, '长沙': 112.93, '郑州': 113.62, '石家庄': 114.51,
  '太原': 112.55, '呼和浩特': 111.75, '西安': 108.93, '兰州': 103.82,
  '银川': 106.23, '西宁': 101.78, '乌鲁木齐': 87.62, '拉萨': 91.14,
  '成都': 104.06, '贵阳': 106.63, '昆明': 102.71, '南宁': 108.37,
  '海口': 110.32, '香港': 114.17, '澳门': 113.54, '台北': 121.50,
  '合肥': 117.23, '南昌': 115.85, '苏州': 120.58, '无锡': 120.31,
  '东莞': 113.75, '佛山': 113.12, '温州': 120.70
};

const ElementIcon = ({ element }: { element: string }) => {
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full border ${ELEMENT_BG[element]} ${ELEMENT_COLORS[element]}`}>
      {element}
    </span>
  );
};

// --- Helper Functions ---

const getElement = (char: string): string => {
  const mapping: Record<string, string> = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水',
    '寅': '木', '卯': '木', '巳': '火', '午': '火', '辰': '土', '戌': '土', '丑': '土', '未': '土', '申': '金', '酉': '金', '亥': '水', '子': '水'
  };
  return mapping[char] || '';
};

const getHiddenStems = (branch: string): string[] => {
  const mapping: Record<string, string[]> = {
    '子': ['癸'], '丑': ['己', '癸', '辛'], '寅': ['甲', '丙', '戊'], '卯': ['乙'],
    '辰': ['戊', '乙', '癸'], '巳': ['丙', '戊', '庚'], '午': ['丁', '己'], '未': ['己', '丁', '乙'],
    '申': ['庚', '壬', '戊'], '酉': ['辛'], '戌': ['戊', '辛', '丁'], '亥': ['壬', '甲']
  };
  return mapping[branch] || [];
};

const formatTime = (date: Date) => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

/**
 * Calculate Equation of Time (EOT) in minutes for a given date.
 * Approximation formula: E = 9.87 sin(2B) - 7.53 cos(B) - 1.5 sin(B)
 * Where B = 360 * (N - 81) / 365 degrees
 */
const getEquationOfTime = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  // B in radians
  const B = (360 * (dayOfYear - 81) / 365) * (Math.PI / 180);
  
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  return eot;
};

// --- Main Component ---

function App() {
  // Form State
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState<string>(formatTime(new Date()));
  const [useSolarTime, setUseSolarTime] = useState<boolean>(false);
  const [useLateRat, setUseLateRat] = useState<boolean>(false); // Late Rat Handling
  
  // Location State
  const [cityName, setCityName] = useState<string>('北京');
  const [longitude, setLongitude] = useState<string>('116.40');
  
  const [result, setResult] = useState<BaziResult | null>(null);

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCityName(name);
    if (CITY_DATA[name]) {
      setLongitude(CITY_DATA[name].toFixed(2));
    }
  };

  // Calculate Logic
  const calculate = () => {
    try {
      const [year, month, day] = date.split('-').map(Number);
      const [hour, minute] = time.split(':').map(Number);
      
      // Base input date (Local Clock Time context)
      // We use this constructed Date purely for YMDHMS extraction and timestamp math
      const inputDate = new Date(year, month - 1, day, hour, minute);

      let adjustedTime = inputDate;
      let solarTimeStr = `${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}`;
      let lmtOffset = 0;
      let eotOffset = 0;

      // --- 1. True Solar Time Correction ---
      if (useSolarTime) {
        const long = parseFloat(longitude);
        if (!isNaN(long)) {
          // A. Local Mean Time (LMT) Offset
          // Difference from UTC+8 (120°). 1° = 4 minutes.
          lmtOffset = (long - 120) * 4;
          
          // B. Equation of Time (EOT) Offset
          // Correction for Earth's elliptical orbit and axial tilt
          eotOffset = getEquationOfTime(inputDate);
          
          const totalOffsetMinutes = lmtOffset + eotOffset;
          
          // Apply offset to get True Solar Time
          adjustedTime = new Date(inputDate.getTime() + totalOffsetMinutes * 60000);
          
          solarTimeStr = `${adjustedTime.getHours().toString().padStart(2, '0')}:${adjustedTime.getMinutes().toString().padStart(2, '0')}:${adjustedTime.getSeconds().toString().padStart(2, '0')} (真太阳)`;
        }
      }

      // --- 2. Generate Pillars ---
      // Solar.fromYmdHms takes YMDHMS. By passing our adjusted TST components, 
      // we force the library to calculate based on the astronomical solar moment.
      const solar = Solar.fromYmdHms(
        adjustedTime.getFullYear(),
        adjustedTime.getMonth() + 1,
        adjustedTime.getDate(),
        adjustedTime.getHours(),
        adjustedTime.getMinutes(),
        adjustedTime.getSeconds()
      );
      
      const lunar = solar.getLunar();
      let bazi = lunar.getEightChar();
      
      // Standard Pillars from library
      // Note: Library typically rolls Day Pillar at 23:00 if standard config
      let yearPillarStr = bazi.getYear();
      let monthPillarStr = bazi.getMonth();
      let dayPillarStr = bazi.getDay();
      let hourPillarStr = bazi.getTime();
      
      // --- 3. Rat Hour Handling (Early/Late Zi) ---
      // If "Late Rat Mode" is ON and hour is 23 (Night Rat / Wan Zi):
      // Requirement: Day Pillar should be CURRENT day, Hour Pillar should be NEXT day's Zi (usually).
      if (useLateRat && adjustedTime.getHours() === 23) {
        // Current logic: lunar-javascript has likely already advanced the Day Pillar for >= 23:00.
        // We need to revert the Day Pillar to the "Previous" day (which is actually the current calendar day before 23:00).
        
        // Calculate pillars for 1 hour ago (22:XX) to get the "Current Day" pillar
        const prevHourDate = new Date(adjustedTime.getTime() - 3600000); 
        const prevSolar = Solar.fromYmdHms(
          prevHourDate.getFullYear(),
          prevHourDate.getMonth() + 1,
          prevHourDate.getDate(),
          prevHourDate.getHours(),
          prevHourDate.getMinutes(),
          prevHourDate.getSeconds()
        );
        const prevLunar = prevSolar.getLunar();
        const prevBazi = prevLunar.getEightChar();
        
        // Override Day Pillar
        dayPillarStr = prevBazi.getDay();
        
        // Keep Hour Pillar as is. 
        // Standard "Night Rat" theory usually uses the Hour Stem derived from the *next* day (Early Rat),
        // or uses a specific mapping. lunar-javascript's default `getTime()` for 23:00 
        // returns the Zi hour of the next day sequence, which is the standard "Wan Zi" result.
        // Example: Jia Day 23:30 -> Standard is Yi Day, Wu Zi Hour.
        // Late Rat Mode -> Jia Day, Wu Zi Hour. (Retain Day, Keep Hour).
      }

      // Get Jie Qi (Solar Terms)
      const prevJie = lunar.getPrevJie();
      const nextJie = lunar.getNextJie();
      
      const constructPillar = (pillarStr: string): BaziPillar => {
        const stem = pillarStr[0];
        const branch = pillarStr[1];
        return {
          stem,
          branch,
          stemElement: getElement(stem),
          branchElement: getElement(branch),
          hiddenStems: getHiddenStems(branch)
        };
      };

      setResult({
        year: constructPillar(yearPillarStr),
        month: constructPillar(monthPillarStr),
        day: constructPillar(dayPillarStr),
        hour: constructPillar(hourPillarStr),
        solarDate: `${solar.getYear()}年${solar.getMonth()}月${solar.getDay()}日`,
        lunarDate: `${lunar.getYearInGanZhi()}年 ${lunar.getMonthInChinese()}月 ${lunar.getDayInChinese()}`,
        jieQi: {
          prev: { name: prevJie.getName(), time: prevJie.getSolar().toYmdHms() },
          next: { name: nextJie.getName(), time: nextJie.getSolar().toYmdHms() }
        },
        solarTime: solarTimeStr,
        timeDetails: {
          lmtOffset: parseFloat(lmtOffset.toFixed(2)),
          eotOffset: parseFloat(eotOffset.toFixed(2)),
          totalOffset: parseFloat((lmtOffset + eotOffset).toFixed(2))
        }
      });

    } catch (e) {
      console.error(e);
      alert('计算出错，请检查输入日期');
    }
  };

  // Run initial calculation
  useEffect(() => {
    calculate();
  }, []);

  return (
    <div className="min-h-screen p-4 md:p-8 flex justify-center items-start">
      <div className="max-w-2xl w-full grid gap-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-serif-sc font-bold text-gray-800">八字排盘</h1>
          <p className="text-gray-500 text-sm">Accurate Bazi Calculator (True Solar Time)</p>
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <CalendarIcon size={16} /> 公历日期
                </label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-400 focus:border-stone-400 outline-none transition-colors bg-stone-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Clock size={16} /> 出生时间
                </label>
                <input 
                  type="time" 
                  value={time} 
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-400 focus:border-stone-400 outline-none transition-colors bg-stone-50"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-gray-100">
              {/* Settings Toggle Area */}
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer hover:text-stone-900">
                  <input 
                    type="checkbox" 
                    checked={useSolarTime}
                    onChange={(e) => setUseSolarTime(e.target.checked)}
                    className="w-4 h-4 text-stone-600 rounded border-gray-300 focus:ring-stone-500"
                  />
                  <span>启用真太阳时校正 (推荐)</span>
                  {useSolarTime && <span className="ml-auto text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">精确模式</span>}
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer hover:text-stone-900">
                  <input 
                    type="checkbox" 
                    checked={useLateRat}
                    onChange={(e) => setUseLateRat(e.target.checked)}
                    className="w-4 h-4 text-stone-600 rounded border-gray-300 focus:ring-stone-500"
                  />
                  <div className="flex flex-col">
                    <span>晚子时归入当天 (23:00-00:00)</span>
                    <span className="text-xs text-gray-400 font-normal">日柱不换，时柱用次日早子</span>
                  </div>
                </label>
              </div>

              {useSolarTime && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-stone-50 p-4 rounded-xl border border-stone-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                         <MapPin size={16} /> 出生城市
                       </label>
                       <div className="relative">
                         <input 
                           type="text" 
                           list="city-list"
                           value={cityName} 
                           onChange={handleCityChange}
                           placeholder="输入城市 (如: 北京)"
                           className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-400 outline-none bg-white"
                         />
                         <datalist id="city-list">
                           {Object.keys(CITY_DATA).map(city => (
                             <option key={city} value={city} />
                           ))}
                         </datalist>
                       </div>
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                         <Info size={16} /> 对应经度
                       </label>
                       <input 
                         type="number" 
                         step="0.01"
                         value={longitude} 
                         onChange={(e) => setLongitude(e.target.value)}
                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-400 outline-none bg-white"
                       />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2.5">
                    * 系统会自动计算 <strong>经度时差</strong> 与 <strong>均时差 (EOT)</strong>
                  </p>
                </div>
              )}
            </div>

            <button 
              onClick={calculate}
              className="w-full py-3 bg-stone-800 hover:bg-stone-900 text-white rounded-xl font-medium transition-all shadow-md active:scale-[0.99] flex justify-center items-center gap-2"
            >
              <RotateCcw size={18} />
              重新排盘
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Pillars Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-stone-200 via-stone-400 to-stone-200"></div>
              
              <div className="grid grid-cols-4 gap-2 md:gap-8 text-center relative z-10">
                <PillarCard title="年柱" pillar={result.year} />
                <PillarCard title="月柱" pillar={result.month} />
                <PillarCard title="日柱" pillar={result.day} />
                <PillarCard title="时柱" pillar={result.hour} />
              </div>

              <div className="mt-8 pt-6 border-t border-dashed border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                 <div>
                    <h3 className="text-gray-500 font-medium mb-2 flex items-center gap-2">
                      <Compass size={14} /> 历法信息
                    </h3>
                    <div className="space-y-1 text-gray-700">
                      <p>公历：{result.solarDate}</p>
                      <p>农历：{result.lunarDate}</p>
                      <p className="font-medium text-stone-800">
                        {result.solarTime}
                      </p>
                      {useSolarTime && (
                         <div className="text-xs text-gray-400 mt-1 pl-1 border-l-2 border-stone-200">
                           <p>经度时差: {result.timeDetails.lmtOffset > 0 ? '+' : ''}{result.timeDetails.lmtOffset}m</p>
                           <p>均时差(EOT): {result.timeDetails.eotOffset > 0 ? '+' : ''}{result.timeDetails.eotOffset}m</p>
                           <p>总修正: {result.timeDetails.totalOffset > 0 ? '+' : ''}{result.timeDetails.totalOffset}m</p>
                         </div>
                      )}
                    </div>
                 </div>
                 <div>
                    <h3 className="text-gray-500 font-medium mb-2 flex items-center gap-2">
                      <Clock size={14} /> 节气参照
                    </h3>
                    <div className="space-y-1 text-gray-700">
                      <p><span className="text-stone-400">上节：</span>{result.jieQi.prev.name} {result.jieQi.prev.time}</p>
                      <p><span className="text-stone-400">下节：</span>{result.jieQi.next.name} {result.jieQi.next.time}</p>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PillarCard({ title, pillar }: { title: string, pillar: BaziPillar }) {
  return (
    <div className="flex flex-col items-center group">
      <span className="text-xs text-gray-400 mb-2 font-serif-sc tracking-widest">{title}</span>
      
      <div className="flex flex-col items-center gap-1">
        {/* Stem */}
        <div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center text-3xl md:text-4xl font-serif-sc font-bold text-gray-800 bg-stone-50 rounded-xl border border-stone-100 shadow-sm group-hover:shadow-md transition-shadow relative">
          {pillar.stem}
          <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ElementIcon element={pillar.stemElement} />
          </div>
        </div>
        
        {/* Branch */}
        <div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center text-3xl md:text-4xl font-serif-sc font-bold text-gray-800 bg-stone-50 rounded-xl border border-stone-100 shadow-sm group-hover:shadow-md transition-shadow relative mt-2">
          {pillar.branch}
          <div className="absolute -bottom-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ElementIcon element={pillar.branchElement} />
          </div>
        </div>
      </div>

      {/* Hidden Stems / Zodiac */}
      <div className="mt-3 text-xs text-gray-400 space-y-0.5 min-h-[3rem]">
        <div className="font-medium text-stone-600">{ZODIAC_MAP[pillar.branch]}</div>
        <div className="flex gap-1 justify-center flex-wrap px-1">
          {pillar.hiddenStems.map((s, i) => (
             <span key={i} className="scale-90">{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
