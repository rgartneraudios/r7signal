// src/utils/moonUtils.js

export const getMoonSuffix = () => {
  const ref = new Date('2024-05-08T15:22:00Z');
  const lunation = 2551442.8;
  const s = (Date.now() - ref.getTime()) / 1000;
  const day = (((s % lunation) + lunation) % lunation / lunation) * 29.53;

  if (day < 2 || day > 27.5) return '1';
  if (day < 13.5)             return '2';
  if (day <= 16.5)            return '3';
  return '4';
};

export const SUFFIX_TO_NOMBRE = {
  '1': 'LUNA_NUEVA',
  '2': 'LUNA_CRECIENTE',
  '3': 'LUNA_LLENA',
  '4': 'LUNA_MENGUANTE'
};

export const SUFFIX_TO_DISPLAY = {
  '1': 'Luna Nueva',
  '2': 'Luna Creciente',
  '3': 'Luna Llena',
  '4': 'Luna Menguante'
};

export const getFaseActualNombre  = () => SUFFIX_TO_NOMBRE[getMoonSuffix()];
export const getFaseActualDisplay = () => SUFFIX_TO_DISPLAY[getMoonSuffix()];

export const getCicloActual = () => {
  const ref      = new Date('2024-05-08T15:22:00Z');
  const lunation = 2551442.8;
  const s        = (Date.now() - ref.getTime()) / 1000;
  return Math.floor(s / lunation) + 1;
};


