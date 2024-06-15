import { BrowserWindow, BrowserWindowConstructorOptions, Menu } from 'electron';
import { WindowManager } from './windowManager';
import fs from 'fs';
import { getAppLocalPath, isObject, isString, readyURL, resolvePosition } from './utils';
import Shortcuts from 'electron-localshortcut'
import { WindowConfig } from './types';

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

  private setup: WindowConfig = {};

  public object: BrowserWindow | null = null;

  constructor(
    private name: string,
    title?: string,
    url?: string,
    setupTemplate?: string,
    setup?: WindowConfig | string,
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

    this.setup = {
      show: false,
      setupTemplate,
    };

    if(title) this.setup.title = title;
    if(url) this.setup.url = url;
    if(showDevTools) this.setup.showDevTools = showDevTools;

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

  /**
   * Sets the window preferred layout
   * @param name The name of the layout, registered using layouts.add()
  */
  useLayout(name: string) {
    this.setup.layout = name;
  }

  /**
  * Sets the setup template to use
  */
  applySetupTemplate(name: string) {
    this.setup.setupTemplate = name;
  }

  /**
   * Sets the target URL for the window
   * */
  setURL(url: string) {
    this.setup.url = url;
  }

  /**
   * Created window instance
   * @param url [optional] The window target URL in case you didn't provide it in the constructor
   * */
  create(url?: string) {
    if (url) {
      this.setup.url = url;
    }

    // Get a copy of the window manager config
    const config = WindowManager.shared.config;

    // If a setup setupTemplate is provided
    let template = this.setup.setupTemplate || config.defaultSetupTemplate;
    if (template && this.setup.setupTemplate !== false) {
      // TODO Get the setupTemplate
      template = WindowManager.shared.templates.get(template);

      // Merge with this window setup
      if (template) {
        this.setup = { ...template, ...this.setup };
      } else {
        console.log(`The setup template "${template}" wasn't found!`);
      }
    }

    // The title
    if(!this.setup.title && config.defaultWindowTitle){
        this.setup.title = config.defaultWindowTitle;
    }

    if(this.setup.title && config.windowsTitlePrefix && !config.defaultWindowTitle){
        this.setup.title = config.windowsTitlePrefix + this.setup.title;
    }

    // Handle the "position" feature/property
    if(this.setup.position){
        // If an array was passed
        if(Array.isArray(this.setup.position)){
            this.setup.x = this.setup.position[0];
            this.setup.y = this.setup.position[1];

        }else{
            // Resolve the position into x & y coordinates
            const xy = resolvePosition(this.setup);
            if(xy){
                this.setup.y = xy[1];
                this.setup.x = xy[0];
            }
        }
    }

     // The defaults
    if(!this.setup.resizable) this.setup.resizable = false;
    if(!this.setup.useContentSize) this.setup.useContentSize = true;
    if(!this.setup.x && !this.setup.y) this.setup.center = true;

    // Create the new browser window instance, with the passed setup
    this.object = new BrowserWindow(this.setup);

    // Log the action
    console.log('Window "' + this.name + '" was created');

      // On load failure
    this.object.webContents.on('did-fail-load', () => {
        this.down();
    });

    // Open the window target content/url
    if(this.setup.url){
        this.loadURL(this.setup.url);
    }

    // If the width/height not provided!
    const bounds = this.object.getBounds();
    if(!this.setup.width) this.setup.width = bounds.width;
    if(!this.setup.height) this.setup.height = bounds.height;

    // Open the window target content/url
    if(this.setup.url){
        this.loadURL(this.setup.url);
    }

    // Set the window menu (null is valid to not have a menu at all)
    if(this.setup.menu !== undefined){
        if(process.platform === 'darwin') {
          Menu.setApplicationMenu(Menu.buildFromTemplate(this.setup.menu));
        } else {
          this.object.setMenu(this.setup.menu);
        }
    }

    // Show the dev tools ?
    if(this.setup.showDevTools === true){
        // TODO Show the dev tools
        this.object.toggleDevTools();
    }

    // On close
    this.object.on('closed', () => {
        console.log('Window "' + this.name + '" was closed');

        // Delete the reference on the windowManager object
        delete WindowManager.shared.windows[this.name];

        // Delete the window object
        this.object = null;
    });

    return this;
  }

  /**
   * Open the created window instance
   * @param url [optional] The window target URL in case you didn't provide it in the constructor
   * @param hide [optional] Whether to show or hide the newely-created window, false by default
   * */
  open(url?: string, hide?: boolean) {
    // If the window is already created
    if (this.object) {
      this.focus();
      return false;
    }

    // Create the window
    this.create(url);

    // Show the window
    if (!hide) {
      this.object!.show();
    }
  }

  /**
   * Makes the focus on this window
   * */
  focus() {
    this.object!.focus();
    return this;
  }

  loadURL(url?: string, options?: any) {
    url = readyURL(url || this.setup.url || '');

    const layout = this.setup.layout !== false ? this.setup.layout || WindowManager.shared.config.defaultLayout : false;

    // TODO If a layout is specified
    let layoutFile = layouts.get(layout);
    if (layout && !layoutFile) {
      console.log(`The layout "${layout}" wasn't found!`);
    }

    if (layout && layoutFile && url.substring(0, 4) !== 'http') {
      url = url.replace('file://', '');
      layoutFile = layoutFile.replace('file://', '');

      // Load the the layout first
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
          
          // Get the final body
          const finalContent = layoutCode
            .replace(/\{\{appBase\}\}/g, getAppLocalPath())
            .replace('{{content}}', content);

          // Load the final output
          this.html(finalContent, options);
        });
      });
    } else {
      // Load the passed url
      this.content().loadURL(url, options);
    }
  }

  /**
   * Sets the content of the window to whatever HTML code your provide
   * @param code The HTML code
   * @param options
   * */
  html(code: string, options?: any) {
    this.content().loadURL('data:text/html;charset=utf-8,' + code, options);
  }

  /**
 * Triggers the load-failure callback. This method is called whenever the targeted content isn't available or
 * accessible. It will display a custom message by default, unless you define a custom callback for the window
 * */
  down() {
    // Force ignore the layout!
    this.setup.layout = false;

    // Either a custom failure call back, or call the global one
    const callback = this.setup.onLoadFailure || WindowManager.shared.config.onLoadFailure;

    // Trigger the call back
    callback.call(null, this);
  }

  /**
 * Returns the "webContents" object of the window
 * */
  content() {
    return this.object!.webContents;
  }

  /**
 * Reload the window content
 * @param ignoreCache By default the page cache will be used, pass TRUE to ignore this cache when reloading
 * */
  reload(ignoreCache?: boolean) {
    if(ignoreCache === true){
        // Reload ignoring the cache!
        this.content().reloadIgnoringCache();
    } else{
        // Reload the content, with the cache available
        this.content().reload();
    }
  }

  /**
 * Returns the url of the current page inside the window
 * */
  currentURL() {
    return this.content().getURL();
  }

  /**
 * A callback to fire when the page is ready
 * @param withTheDomReady Pass true to execute the callback when the DOM is ready, and not just the page have loaded
 * @param callback The callback to trigger when the page is ready. This callback is passed two to parameters;
 * the first is the window instance object, and the second is the window content object
 * */
  onReady(withTheDomReady: boolean, callback: (window: Window, content: Electron.WebContents) => void) {
    const event = withTheDomReady === true ? 'dom-ready' :'did-finish-load';

    // Fire the callback and pass the window .webContents to it
    this.content().on(event, () => {
        callback.call(null, this, this.content());
    });
  }

  /**
 * Executes JS code on the created window
 * @param code The JS code
 * */
  execute(code: string) {
    this.content().executeJavaScript(code);
  }

  /**
 * Go back to the previous page/url to the current
 * */
  goBack() {
    if(this.content().canGoBack()){
        this.content().goBack();
    }
  }

  /**
 * Closes the window
 * */
  close() {
      this.object!.close();
  }

  /**
 * Destroys the BrowserWindow and this instance
 * */
  destroy() {
    this.object!.destroy();
    console.log('Window "' + this.name + '" was destroyed');
  }

  /**
 * Minimizes the window
 * */
  minimize() {
    this.object!.minimize();

    return this;
  }

  /**
 * Maximizes/Unmaximizes the window
 * */
  maximize() {
    if (!this.object) return this;
    if(this.object.isMaximized()) this.object.restore();
    else this.object.maximize();

    return this;
  }

  /**
 * Restore the window into focus
 * */
  restore() {
    this.object!.restore();

    return this;
  }

  /**
 * Toggles developer tools
 * @param detached [optional] Whether to open the dev tools in a separate window or not
 * */
  toggleDevTools(detached?: boolean) {
    this.object!.toggleDevTools({detached: detached || false});
    return this;
  }

  /**
 * Attaching shortcut to the window
 * */
  registerShortcut(accelerator: string, callback: (window: Window) => void) {
    Shortcuts.register(this.object!, accelerator, () => {
        callback.call(null, this);
    });

    return this;
  }

  /**
 * Moves the window to a specific x y position, or you can simple use a pre-defined position, like "right", "left"
 * "topLeft", "bottomRight", ...
 * */
  move(x: number | string, y?: number) {
    // Get the window bounds first
    const bounds = this.object!.getBounds();

    // If a position name was provided
    if(isString(x)){
        this.setup.position = x;
        const xy = resolvePosition(this.setup);

        if(xy){
            x = xy[0];
            y = xy[1]
        }
    }

    // Set the bounds
    this.object!.setBounds({
        x: x || bounds.x,
        y: y || bounds.y,
        width: this.setup.width,
        height: this.setup.height
    });

    return this;
  }

  /**
 * Resize the window, by entering either the width or the height, or both
 * */
  resize(width?: number, height?: number) {
    // Get the current bounds
    const bounds = this.object!.getBounds();

    this.object!.setBounds({
      'width': width || bounds.width,
      'height': height || bounds.height,
      'x': bounds.x,
      'y': bounds.y
    });

    return this;
  }

  // 其他方法...
}