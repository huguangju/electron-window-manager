import { BrowserWindow, BrowserWindowConstructorOptions, Menu } from 'electron';
import { WindowManager } from './windowManager';
import fs from 'fs';
import { isObject, isString } from './utils';

/**
 * 创建新窗口实例
 * @param name [可选] 窗口的代码名称,每个窗口必须有一个唯一的名称
 * @param title [可选] 窗口标题
 * @param url [可选] 窗口要加载的目标页面/URL
 * @param setupTemplate [可选] 你想为这个新窗口使用的设置模板的名称
 * @param setup [可选] 将传递给 BrowserWindow 模块的设置对象
 * @param showDevTools [可选] 是否显示开发者工具, 默认为 false
 */
export class Window {
  private browserWindow: BrowserWindow | null = null;

  private setup: BrowserWindowConstructorOptions | null = null;

  public config: {
    setupTemplate?: string;
    url?: string;
    showDevTools?: boolean;
    [key: string]: any;
  } = {};

  private object: BrowserWindow | null;

  constructor(
    private name: string,
    title?: string,
    url?: string,
    setupTemplate?: string,
    setup?: BrowserWindowConstructorOptions | string,
    config?: Record<string, any>,
    showDevTools?: boolean
  ) {
    // Check if the window already exists
    if(WindowManager.shared.windows[name]){
        console.log(`Window ${name} already exists!`);

        // Move the focus on it
        WindowManager.shared.focusOn(name);
        return;
    }

    // The window unique name, if omitted a serialized name will be used instead; window_1 ~> window_2 ~> ...
    this.name = name || `window_${Object.keys(WindowManager.shared.windows).length + 1}`;

    // The BrowserWindow module instance
    this.object = null;

    this.setup = {
        show: false,
        // setupTemplate: setupTemplate
    };
    this.config = {
      setupTemplate
    }

    if(title) this.setup.title = title;
    // if(url) this.setup.url = url;
    // if(showDevTools) this.setup.showDevTools = showDevTools;
    if(url) this.config.url = url;
    if(showDevTools) this.config.showDevTools = showDevTools;

    // If the setup is just the window dimensions, like '500x350'
    if(isString(setup) && (setup as string).indexOf('x') >= 0){
      const dimensions = (setup as string).split('x');
      setup = {
        width: parseInt(dimensions[0], 10),
        height: parseInt(dimensions[1], 10)
      };
    }

    // Overwrite the default setup
    if(isObject(setup)){
      this.setup = Object.assign(this.setup, setup);
    }

    // Register the window on the window manager
    WindowManager.shared.windows[this.name] = this;
  }

  /**
  * Updates the window setup
  */
  set(prop: string | object, value?: any) {
    if (typeof prop === 'string' && value !== undefined) {
      this.setup[prop] = value;
    } else if (typeof prop === 'object') {
      this.setup = { ...this.setup, ...prop };
    }
  }

  useLayout(name: string) {
    this.setup.layout = name;
  }

  applySetupTemplate(name: string) {
    this.setup.setupTemplate = name;
  }

  setURL(url: string) {
    this.setup.url = url;
  }

  create(url?: string) {
    if (url) {
      this.setup.url = url;
    }

    const windowManager = (global as any).windowManager as WindowManager;
    const config = windowManager.config;
    let template = this.setup.setupTemplate || config.defaultSetupTemplate;

    if (template && this.setup.setupTemplate !== false) {
      template = windowManager.templates.get(template);
      if (template) {
        this.setup = { ...template, ...this.setup };
      } else {
        console.log(`The setup template "${template}" wasn't found!`);
      }
    }

    // 处理其他设置...

    this.browserWindow = new BrowserWindow(this.setup);
    console.log(`Window "${this.name}" was created`);

    // 其他事件处理...
  }

  open(url?: string, hide?: boolean) {
    if (this.browserWindow) {
      this.focus();
      return false;
    }

    this.create(url);

    if (!hide) {
      this.browserWindow.show();
    }
  }

  focus() {
    if (this.browserWindow) {
      this.browserWindow.focus();
    }
    return this;
  }

  loadURL(url?: string, options?: any) {
    const windowManager = (global as any).windowManager as WindowManager;
    const utils = windowManager.utils;
    url = utils.readyURL(url || this.setup.url);

    const layout = this.setup.layout !== false ? this.setup.layout || windowManager.config.defaultLayout : false;
    let layoutFile = layout ? windowManager.layouts.get(layout) : undefined;

    if (layout && !layoutFile) {
      console.log(`The layout "${layout}" wasn't found!`);
    }

    if (layout && layoutFile && url.substring(0, 4) !== 'http') {
      url = url.replace('file://', '');
      layoutFile = layoutFile.replace('file://', '');

      fs.readFile(layoutFile, 'utf-8', (error, layoutCode) => {
        if (error) {
          console.log(`Couldn't load the layout file: ${layoutFile}`);
          this.down();
          return false;
        }

        fs.readFile(url, 'utf-8', (error, content) => {
          if (error) {
            console.log(`Couldn't load the target file: ${url}`);
            this.down();
            return false;
          }

          const finalContent = layoutCode.replace(/\{\{appBase\}\}/g, utils.getAppLocalPath()).replace('{{content}}', content);
          this.html(finalContent, options);
        });
      });
    } else {
      if (this.browserWindow) {
        this.browserWindow.loadURL(url, options);
      }
    }
  }

  html(code: string, options?: any) {
    if (this.browserWindow) {
      this.browserWindow.loadURL(`data:text/html;charset=utf-8,${code}`, options);
    }
  }

  down() {
    this.setup.layout = false;
    const windowManager = (global as any).windowManager as WindowManager;
    const callback = this.setup.onLoadFailure || windowManager.config.onLoadFailure;
    callback(this);
  }

  content() {
    return this.browserWindow?.webContents || null;
  }

  reload(ignoreCache?: boolean) {
    if (this.browserWindow) {
      if (ignoreCache) {
        this.browserWindow.webContents.reloadIgnoringCache();
      } else {
        this.browserWindow.webContents.reload();
      }
    }
  }

  currentURL() {
    return this.browserWindow?.webContents.getURL() || '';
  }

  onReady(withTheDomReady: boolean, callback: (window: Window, content: Electron.WebContents) => void) {
    const event = withTheDomReady ? 'dom-ready' : 'did-finish-load';
    if (this.browserWindow) {
      this.browserWindow.webContents.on(event, () => {
        callback(this, this.browserWindow!.webContents);
      });
    }
  }

  execute(code: string) {
    if (this.browserWindow) {
      this.browserWindow.webContents.executeJavaScript(code);
    }
  }

  goBack() {
    if (this.browserWindow && this.browserWindow.webContents.canGoBack()) {
      this.browserWindow.webContents.goBack();
    }
  }

  close() {
    if (this.browserWindow) {
      this.browserWindow.close();
    }
  }

  destroy() {
    if (this.browserWindow) {
      this.browserWindow.destroy();
      console.log(`Window "${this.name}" was destroyed`);
      this.browserWindow = null;
    }
  }

  minimize() {
    if (this.browserWindow) {
      this.browserWindow.minimize();
    }
    return this;
  }

  maximize() {
    if (this.browserWindow) {
      if (this.browserWindow.isMaximized()) {
        this.browserWindow.restore();
      } else {
        this.browserWindow.maximize();
      }
    }
    return this;
  }

  restore() {
    if (this.browserWindow) {
      this.browserWindow.restore();
    }
    return this;
  }

  toFullScreen() {
    if (this.browserWindow) {
      this.browserWindow.setFullScreen(true);
    }
    return this;
  }

  toggleDevTools(detached?: boolean) {
    if (this.browserWindow) {
      this.browserWindow.toggleDevTools({ detached: detached || false });
    }
    return this;
  }

  registerShortcut(accelerator: string, callback: (window: Window) => void) {
    if (this.browserWindow) {
      const windowManager = (global as any).windowManager as WindowManager;
      windowManager.shortcuts.register(this.browserWindow, accelerator, () => {
        callback(this);
      });
    }
    return this;
  }

  move(x: number | string, y?: number) {
    if (this.browserWindow) {
      const bounds = this.browserWindow.getBounds();
      if (typeof x === 'string') {
        this.setup.position = x;
        const xy = (global as any).windowManager.utils.resolvePosition(this.setup);
        if (xy) {
          x = xy[0];
          y = xy[1];
        }
      }
      this.browserWindow.setBounds({
        x: typeof x === 'number' ? x : bounds.x,
        y: typeof y === 'number' ? y : bounds.y,
        width: this.setup.width,
        height: this.setup.height,
      });
    }
    return this;
  }

  resize(width?: number, height?: number) {
    if (this.browserWindow) {
      const bounds = this.browserWindow.getBounds();
      this.browserWindow.setBounds({
        width: width || bounds.width,
        height: height || bounds.height,
        x: bounds.x,
        y: bounds.y,
      });
    }
    return this;
  }

  // 其他方法...
}