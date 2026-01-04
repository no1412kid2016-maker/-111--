import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Solar, Lunar } from 'https://esm.sh/lunar-javascript@1.6.12';
import { Compass, Clock, MapPin, Info, Calendar as CalendarIcon, RotateCcw, Settings, HelpCircle } from 'lucide-react';

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
  hour: BaziPillar | null; // Hour can be null if time is unknown
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
  } | null;
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

const getHiddenStems =