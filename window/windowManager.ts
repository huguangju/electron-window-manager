import { BrowserWindow, app, Menu } from 'electron';
import { EventEmitter } from 'node:events';
import Shortcuts from 'electron-localshortcut';
import { Window } from './window';
import { WindowConfig, WindowGlobalConfig } from './types';
import { getAppLocalPath, isObject, isString, readyURL } from './utils';
const Watcher = require('melanke-watchjs');

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

  /**
 * The Window instances, stored by names
 * */
  public windows: { [key: string]: Window } = {};

  /**
 * The setup templates. Where you can create a ready-to-use setup templates/groups for the BrowserWindow instance
 * */
  private templates: Record<string, WindowConfig> = {};

  /**
   * Manges the layouts information
   * */
  private layouts: Record<string, any> = {};

    /**
   * The global configuration
   * */
  public config: WindowGlobalConfig = {
    'appBase': null, // The full path to the application directory
    'devMode': true, // Turns the development mode on/off
    'layouts': false, // A list of the layouts, a direct shortcut, instead of using layouts.add for each layout
    'defaultLayout': false, // The default layout name
    'defaultSetupTemplate': false, // The default setup template name
    'defaultWindowTitle': null, // The default window title
    'windowsTitlePrefix': null, // A prefix for the windows title
    /**
     * The window url global load-failure callback
     * */
    onLoadFailure: (window: Window) => {
      window.content()!.loadURL(`file://${__dirname}/loadFailure.html`);
    },
  };

  /**
   * The shared data/values
   * */
  public shareData: Record<string, any> = {};

  constructor(config?: string | { [key: string]: any }) {
    // 初始化配置
    // this.initConfig(config);

    // 初始化其他模块
    // this.templates = new Templates();
    // this.layouts = new Layouts();

    // 其他初始化代码...
  }

    /**
   * Initiate the module
   * @param config The configuration for the module
   * */
  init (config: any) {
    if(isString(config)){
        this.config.appBase = config;
    } else if(isObject(config)){// If the config object is provided
        this.config = Object.assign(this.config, config);
    }

    // If the app base isn't provided
    if(!this.config.appBase){
        this.config.appBase = getAppLocalPath();
    }else if(this.config.appBase.length && this.config.appBase[this.config.appBase.length-1] !== '/'){
        this.config.appBase += '/';
    }

    // If the layouts list was passed in the config
    if(this.config.layouts && isObject(this.config.layouts)){
        Object.keys(this.config.layouts).forEach(key => {
            this.addLayout(key, this.config.layouts[key]);
        });
    }

    // If the dev mode is on
    if(this.config.devMode === true){
        // Attach some shortcuts
        app.on('ready', () => {

            // Ctrl+F12 to toggle the dev tools
            Shortcuts.register('CmdOrCtrl+F12', () => {
                const window = this.getCurrent();
                if(window) window.toggleDevTools();
            });

            // Ctrl+R to reload the page
            Shortcuts.register('CmdOrCtrl+R', () => {
                const window = this.getCurrent();
                if(window) window.reload();
            });

        });
    }

    // If a default setup is provided
    if(this.config.defaultSetup){
        this.setDefaultSetup(this.config.defaultSetup);
        delete this.config.defaultSetup;
    }
  }

    /**
   * Sets the default setup for all the BrowserWindow instances, unless a different template is selected
   * or false is passed instead. It creates a new template with the name "default" for this setup.
   * @param setup The setup object
   * */
  setDefaultSetup (setup: any) {
      if(!isObject(setup)) return false;

      // Add the setup template
      this.setTemplate('default', setup);

      // Make it the default setup
      this.config.defaultSetupTemplate = 'default';
  }

    /**
   * Using this method you can create more than one window with the setup information retrieved from a JSON file.
   * */
  importList (file: string){
      const list = require(getAppLocalPath() + file);
      if(!isObject(list)) return false;

      Object.keys(list).forEach(key => {
          let window = list[key];
          this.createNew(key, window.title, window.url, window.setupTemplate, window.setup);
      });
  }

  /**
   * Create a new window instance. Check the Window object for documentation.
   * */
  createNew (name, title, url, setupTemplate, setup, showDevTools) {
      // Create the window instance
      const window = new Window(name, title, url, setupTemplate, setup, showDevTools);

      // If the window was created
      return (window == null || Object.keys(window).length === 0) ?false :window;
  }

  /**
   * Opens a new window
   * */
  open (name, title, content, setupTemplate, setup, showDevTools) {
      const window = this.createNew(name, title, content, setupTemplate, setup, showDevTools);
      if(window) window.open();
      return window;
  }

     /**
     * Create a clone of the passed window
     * */
    clone (name: string){
        const window = this.get(name);
        if(!window) return;

        return this.createNew(false, false, false, false, this.setup);
    }

    /**
     * Get a window instance, by name
     * */
    get (name: string){
        if(!this.windows[name]){
            console.log('Window ' + name + ' doesn\'t exist!');
            return false;
        }

        return this.windows[name];
    }

    /**
     * Get a window instance, by BrowserWindow instance id
     */
    getById (id: number) {
        let instance: Window | null = null;
        Object.keys(this.windows).forEach(key => {
            let window = this.windows[key];
            if(window?.object?.id === id){
                instance = window;
            }
        });
        return instance;
    }

    /**
     * Fetches the currently-under-focus window
     * */
    getCurrent (): Window | null {
        const thisWindow = BrowserWindow.getFocusedWindow();
        if(!thisWindow) return null;

        return this.getById(thisWindow.id);
    }

    /**
     * Closes a window, by name
     * */
    close (name: string){
      const win = this.get(name)
      if (win) {
        win.object!.close();
      }
    }

    /**
     * Closes this/current window
     * */
    closeCurrent (){
        const current = this.getCurrent();
        if(current) current.close();
    }

    /**
     * Destroy a window instance by name
     * */
    destroy (name){
        this.get(name).destroy();
    }

    /**
     * Close all windows created by this module
     * */
    closeAll (){
        Object.keys(this.windows).forEach(key => {
            let window = this.windows[key];
            window.close();
        });
    }

    /**
     * Close all window except for one
     * */
    closeAllExcept (name){
        // Get all the windows
        const windows = BrowserWindow.getAllWindows();

        // Get the window through the name
        const windowID = this.get(name).object.id;
        if(!windows.length || !windowID) return false;

        // Loop through the windows, close all of them and focus on the targeted one
        Object.keys(windows).forEach(key => {
            let window = windows[key];
            if(window.id !== windowID){
                window.close();
            }
        });

        this.get(name).focus();
    }

    /**
     * Focuses on a specific, by name
     * */
    focusOn (name: string){
        this.get(name).focus();
    }

    /**
     * Maximize a window by name
     * */
    maximize (name: string){
        const win = (name) ? this.get(name) : this.getCurrent();
        win.maximize();
    }

    /**
     * Minimize a window by name
     * */
    minimize (name: string){
        const win = (name) ? this.get(name) : this.getCurrent();
        win.minimize();
    }

    /**
     * Restore a window by name
     * */
    restore (name: string){
        this.get(name).object.restore();
    }

    /**
     * Show a window by name
     * */
    show (name: string){
        const win = (name) ? this.get(name) : this.getCurrent();
        win.object.show();
    }

    /**
     * Hide a window by name
     * */
    hide (name: string){
        const win = (name) ? this.get(name) : this.getCurrent();
        win.object.hide();
    }

    /**
     * This method simply takes two values, the first is the one that goes when the development mode is on and
     * the other is when it's off, and according to whether it's on or off, the corresponding value will be returned
     * */
    devModeChoice (whenDevMode: boolean, whenNotDevMode: boolean){
        return (this.config.devMode === true) ?whenDevMode: whenNotDevMode;
    }

  // 其他方法,如 createNew(), open(), close(), focusOn() 等...

  /**
 * Set a new template
 * */
  public setTemplate (name: string, setup: WindowConfig) {
    if(!isObject(setup) || this.templates[name]) return false;

    this.templates[name] = setup;
  }

  /**
 * Fetches the setup by name
 * */
  public getTemplate (name: string) {
    return Object.assign({}, this.templates[name]);
  }

    /**
   * Change/modify the template properties
   * @param name The name of the template
   * @param setup The new changes, as an object
   * */
  public modifyTemplate (name: string, setup: WindowConfig) {
    if(!isObject(setup) || !this.templates[name]) return false;
    this.templates[name] = Object.assign(this.getTemplate(name), setup);
  }


  /**
   * Return a setup property value of a setup templates
   * @param name The name of the template
   * @param prop The property needed back
   * */
  public getTemplateProp (name: string, prop: string) {
    return this.getTemplate(name)[prop];
  }

  /**
   * Registers a new layout
   * @param name The name of the layout
   * @param path The path to the layout. It will be automatically prefixed with the app full path
   * */
  public addLayout (name: string, path: string) {
    this.layouts[name] = readyURL(path);
  }

    /**
   * Retrieves the layout path, by name
   * @param name The name of the layout registered earlier
   * */
  public getLayout (name: string) {
    return this.layouts[name];
  }

  /**
   * Sets a new key/value pair
   * */
  public setShareData (key: string, value: any){
      this.shareData[key] = value;
  }

  /**
   * Fetches a stored value from the data store, by the property name
   * @param key The key of the value
   * @param altValue The alternative value to return in case the passed key doesn't exist
   * */
  public fetchShareData (key: string, defaultValue: any){
      return this.shareData[key] ? this.shareData[key] : defaultValue;
  }

  /**
   * Watches for property changes in the shared data, and triggers a callback whenever a change happens
   * */
  public watchShareData (prop: string, callback: any){
      Watcher.watch(this.shareData, prop, callback);
  }

  /**
  * Unwatches the property in the shared data associated with the callback function
  * */
  public unwatchShareData (prop: string, callback: any){
      Watcher.unwatch(this.shareData, prop, callback);
  }
}
