/**
 * Facebook JS SDK Loader and Initializer
 */

let isSdkReady = false;

export interface FbInitOptions {
  appId: string;
  version?: string;
}

export function loadFacebookSdk(options: FbInitOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return reject(new Error("Browser environment required"));
    }

    if ((window as any).FB && isSdkReady) {
      return resolve();
    }

    const prevAsyncInit = (window as any).fbAsyncInit;
    (window as any).fbAsyncInit = function () {
      if (typeof prevAsyncInit === "function") prevAsyncInit();

      try {
        (window as any).FB.init({
          appId: options.appId,
          cookie: true,
          xfbml: true,
          version: options.version || "v19.0"
        });
        isSdkReady = true;
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    if (document.getElementById("facebook-jssdk")) {
      if ((window as any).FB) {
        try {
          (window as any).FB.init({
            appId: options.appId,
            cookie: true,
            xfbml: true,
            version: options.version || "v19.0"
          });
          isSdkReady = true;
          return resolve();
        } catch (err) {
          return reject(err);
        }
      }
      return;
    }

    const js = document.createElement("script");
    js.id = "facebook-jssdk";
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    js.async = true;
    js.defer = true;
    js.onerror = () => reject(new Error("Failed to load Facebook SDK"));

    const fjs = document.getElementsByTagName("script")[0];
    if (fjs && fjs.parentNode) {
      fjs.parentNode.insertBefore(js, fjs);
    } else {
      document.head.appendChild(js);
    }
  });
}
