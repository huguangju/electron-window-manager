import { BrowserWindow, app, Menu } from 'electron';
import { EventEmitter } from 'events';
import shortcut from 'electron-localshortcut';
import { Window } from './window';
import { WindowGlobalConfig } from './types';

/**
 * 窗口管理器
 */
export class WindowManager {
  private static instance: WindowManager

  static get shared(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager()
    }
    return WindowManager.instance
  }

  public windows: { [key: string]: Window } = {};

  private templates: Templates;

  private layouts: Layouts;

  private eventEmitter: EventEmitter;

  private shortcuts: typeof shortcut;

  public config: WindowGlobalConfig = {
    appBase: null,
    devMode: true,
    layouts: false,
    defaultLayout: false,
    defaultSetupTemplate: false,
    defaultWindowTitle: null,
    windowsTitlePrefix: null,
    onLoadFailure: (window: Window) => {
      window.content()!.loadURL(`file://${__dirname}/loadFailure.html`);
    },
  };

  constructor(config?: string | { [key: string]: any }) {
    // 初始化配置
    this.initConfig(config);

    // 初始化其他模块
    this.templates = new Templates();
    this.layouts = new Layouts();
    this.utils = new Utils(this);
    this.eventEmitter = new EventEmitter();
    this.shortcuts = shortcut;

    // 其他初始化代码...
  }

  // 其他方法,如 createNew(), open(), close(), focusOn() 等...
}

export class Templates {
  private templates: { [key: string]: any } = {};

  /**
   * 注册一个新的设置模板
   * @param name 模板名称
   * @param template 模板对象
   */
  add(name: string, template: any) {
    this.templates[name] = template;
  }

  /**
   * 获取指定名称的模板
   * @param name 模板名称
   */
  get(name: string): any {
    return this.templates[name];
  }
}

export class Layouts {
  private layouts: { [key: string]: string } = {};
  private utils: Utils;

  constructor(utils: Utils) {
    this.utils = utils;
  }

  /**
   * 注册一个新的布局
   * @param name 布局名称
   * @param path 布局文件路径
   */
  add(name: string, path: string) {
    this.layouts[name] = this.utils.readyURL(path);
  }

  /**
   * 获取指定名称的布局路径
   * @param name 布局名称
   */
  get(name: string): string | undefined {
    return this.layouts[name];
  }
}

export class SharedData {
  private data: { [key: string]: any } = {};

  /**
   * 设置共享数据
   * @param key 键
   * @param value 值
   */
  set(key: string, value: any) {
    this.data[key] = value;
  }

  /**
   * 获取共享数据
   * @param key 键
   */
  get(key: string): any {
    return this.data[key];
  }
}