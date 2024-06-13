import path from 'path';
import url from 'url';
import { app, BrowserWindowConstructorOptions } from 'electron'
import { WindowManager } from './windowManager';

/**
 * 返回应用程序目录的完整路径
 */
export const getAppLocalPath = (): string => {
  return app.getAppPath() + '/'
}

/**
 * 准备要打开的 URL。如果以 "/" 开头, 则会加上应用程序目录路径作为前缀。
 * 如果包含 "{appBase}", 则会用应用程序路径替换该值。
 */
export const readyURL = (url: string): string => {
  const { appBase } = WindowManager.shared.config!
  if (url.startsWith('/')) {
    return appBase + url.substring(1);;
  }

  return url.replace('{appBase}', appBase);
}

/**
 * 将位置名称解析为 x 和 y 坐标
 * @param setup 窗口设置对象
 */
export function resolvePosition(setup: BrowserWindowConstructorOptions): [number, number] | false {
  const screen = Electron.screen;
  const screenSize = screen.getPrimaryDisplay().workAreaSize;
  const position = setup.position;
  let x = 0;
  let y = 0;
  const positionMargin = 0;
  let windowWidth = setup.width;
  let windowHeight = setup.height;

  // If the window dimensions are not set
  if(!windowWidth || !windowHeight){
      console.log('Cannot position a window with the width/height not defined!');

      // Put in in the center
      setup.center = true;
      return false;
  }

  // If the position name is incorrect
  if(['center', 'top', 'right', 'bottom', 'left', 'topLeft', 'leftTop', 'topRight',
          'rightTop', 'bottomRight', 'rightBottom', 'bottomLeft', 'leftBottom'].indexOf(position) < 0){

      console.log('The specified position "' + position + '" is\'not correct! Check the docs.');
      return false;
  }

  // It's center by default, no need to carry on
  if(position === 'center'){
      return false;
  }

  // Compensate for the frames
  if (setup.frame === true) {
      switch (position) {
          case 'left':
              break;

          case 'right':
              windowWidth += 8;
              break;

          case 'top':
              windowWidth += 13;
              break;

          case 'bottom':
              windowHeight += 50;
              windowWidth += 13;
              break;

          case 'leftTop':
          case 'topLeft':
              windowWidth += 0;
              windowHeight += 50;
              break;

          case 'rightTop':
          case 'topRight':
              windowWidth += 8;
              windowHeight += 50;
              break;

          case 'leftBottom':
          case 'bottomLeft':
              windowWidth -= 0;
              windowHeight += 50;
              break;

          case 'rightBottom':
          case 'bottomRight':
              windowWidth += 8;
              windowHeight += 50;
              break;
      }
  }

  switch (position) {
      case 'left':
          y = Math.floor((screenSize.height - windowHeight) / 2);
          x = positionMargin - 8;
          break;

      case 'right':
          y = Math.floor((screenSize.height - windowHeight) / 2);
          x = (screenSize.width - windowWidth) - positionMargin;
          break;

      case 'top':
          y = positionMargin;
          x = Math.floor((screenSize.width - windowWidth) / 2);
          break;

      case 'bottom':
          y = (screenSize.height - windowHeight) - positionMargin;
          x = Math.floor((screenSize.width - windowWidth) / 2);
          break;

      case 'leftTop':
      case 'topLeft':
          y = positionMargin;
          x = positionMargin - 8;
          break;

      case 'rightTop':
      case 'topRight':
          y = positionMargin;
          x = (screenSize.width - windowWidth) - positionMargin;
          break;

      case 'leftBottom':
      case 'bottomLeft':
          y = (screenSize.height - windowHeight) - positionMargin;
          x = positionMargin - 8;
          break;

      case 'rightBottom':
      case 'bottomRight':
          y = (screenSize.height - windowHeight) - positionMargin;
          x = (screenSize.width - windowWidth) - positionMargin;
          break;
  }

  return [x, y];
}

export const isObject = (obj: any) => {
  const type = typeof obj;
  return type === 'function' || type === 'object' && !!obj;
};

export const isString = (str: any) => {
  return Object.prototype.toString.call(str) === '[object String]';
};