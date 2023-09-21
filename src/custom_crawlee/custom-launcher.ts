import {PlaywrightBrowserLauncher, PlaywrightExtraClass} from "playwright-extra";
import {BrowserServer, BrowserType, LaunchOptions} from "playwright-core";

export default class PanpricesChromiumExtra extends PlaywrightExtraClass implements BrowserType<{}>{

    private _wrappedLauncher: BrowserType<{}>;

    constructor(launcher: BrowserType<{}>) {
        super(launcher);
        this._wrappedLauncher = launcher;
    }

    override launchPersistentContext(...args: Parameters<PlaywrightBrowserLauncher['launchPersistentContext']>): ReturnType<PlaywrightBrowserLauncher["launchPersistentContext"]> {
        if (args.length > 1 && args[1]) {
            // @ts-ignore
            args[1]["defaultViewport"] = {
                "width": 1920,
                "height": 1080
            }
            // @ts-ignore
            args[1]["screen"] = {
                "width": 1920,
                "height": 1080
            }
            // @ts-ignore
            args[1]["viewport"] = null;
        }
        return super.launchPersistentContext(...args);
    }

    override launch(...args: Parameters<PlaywrightBrowserLauncher['launch']>): ReturnType<PlaywrightBrowserLauncher["launch"]> {
        // @ts-ignore
        if (args.length > 0 && args[0] && args[0]["defaultViewport"]) {
            // @ts-ignore
            args[0]["defaultViewport"] = {
                "width": 1920,
                "height": 1080
            }
            // @ts-ignore
            args[0]["screen"] = {
                "width": 1920,
                "height": 1080
            }
            // @ts-ignore
            args[0]["viewport"] = null;
        }

        return this._wrappedLauncher.launch(...args);
    }

    executablePath(): string {
        return this._wrappedLauncher.executablePath();
    }

    launchServer(options?: LaunchOptions): Promise<BrowserServer> {
        return this._wrappedLauncher.launchServer(options);
    }

    name(): string {
        return this._wrappedLauncher.name();
    }

}