import { Window } from './window';

/**
 * The global configuration
*/
export interface WindowGlobalConfig {
  /**
   * The full path to the application directory
   */
  appBase: string | null;
  /**
   * Turns the development mode on/off
   */
  devMode: boolean;
  /**
   * A list of the layouts, a direct shortcut, instead of using layouts.add for each layout
   */
  layouts: { [key: string]: any; } | boolean;
  /**
   * The default layout name
   */
  defaultLayout: string | boolean;
  /**
   * The default setup template name
   */
  defaultSetupTemplate: string | boolean;
  /**
   * The default window title
   */
  defaultWindowTitle: string | null;
  /**
   * A prefix for the windows title
   */
  windowsTitlePrefix: string | null;
  /**
   * The window url global load-failure callback
   */
  onLoadFailure: (window: Window) => void;
}