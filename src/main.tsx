import "@logseq/libs";
import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { BUTTONS, LOADING_STYLE, SETTINGS_SCHEMA } from "./helper/constants";
import {
  checkout,
  commit,
  commitMessage,
  log,
  pull,
  pullRebase,
  push,
  status,
} from "./helper/git";
import {
  checkStatus,
  debounce,
  hidePopup,
  setPluginStyle,
  showPopup,
  checkIsSynced,
  checkStatusWithDebounce,
  getPluginStyle,
  fetchAndMaybeAutoPull,
} from "./helper/util";
import "./index.css";

const isDevelopment = import.meta.env.DEV

const getButtons = () => {
  const settingsButtons = (logseq.settings?.buttons as string[] | undefined)
  const defaultButtons = (SETTINGS_SCHEMA.find((s) => s.key === "buttons")
    ?.default as string[] | undefined)
  const titles = settingsButtons && settingsButtons.length
    ? settingsButtons
    : (defaultButtons ?? [])
  return titles
    .map((title) => BUTTONS.find((b) => b.title === title))
    .filter(Boolean)
}

const canAccessTopDocument = () => {
  try {
    // Accessing top.document can throw on Linux (cross-origin)
    // @ts-ignore
    return typeof top !== "undefined" && !!top?.document?.body
  } catch (e) {
    return false
  }
}

const renderButtonsProvideUI = (operations?: Record<string, any>) => {
  const buttons = getButtons()
  if (!buttons?.length) return

  const buttonsHtml = buttons
    .map((button: any) =>
      `<button data-on-click="${button?.event}" class="ui__button plugin-git-${button?.key} bg-indigo-600 hover:bg-indigo-700 focus:border-indigo-700 active:bg-indigo-700 text-center text-sm p-1" style="margin: 4px 0; color: #fff; background-color:#4f46e5; border:1px solid #4338ca; border-radius:6px;">${button?.title}</button>`
    )
    .join("\n")

  logseq.provideUI({
    key: "logseq-git-popup",
    path: "body",
    replace: true,
    template: `
      <div class="plugin-git-container">
        <div class="plugin-git-mask" data-on-click="hidePopup"></div>
        <div class="plugin-git-popup flex flex-col">
          ${buttonsHtml}
        </div>
      </div>
    `,
  })
}

const renderButtonsLegacy = (operations?: Record<string, any>) => {
  const buttons = getButtons()
  if (!buttons?.length) return

  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `
          <div class="plugin-git-container">
            <div class="plugin-git-mask"></div>
            <div class="plugin-git-popup flex flex-col">
              ${buttons
                .map(
                  (button: any) =>
                    `<button class="ui__button plugin-git-${button?.key} bg-indigo-600 hover:bg-indigo-700 focus:border-indigo-700 active:bg-indigo-700 text-center text-sm p-1" style="margin: 4px 0; color: #fff; background-color:#4f46e5; border:1px solid #4338ca; border-radius:6px;">${button?.title}</button>`
                )
                .join("\n")}
          </div>
          `,
    "text/html"
  )

  // @ts-ignore
  const container = top?.document?.querySelector(".plugin-git-container")
  // @ts-ignore
  if (container) top?.document?.body.removeChild(container)
  // @ts-ignore
  top?.document?.body.appendChild(doc.body.childNodes?.[0]?.cloneNode(true))
  // @ts-ignore
  top?.document
    ?.querySelector(".plugin-git-mask")
    ?.addEventListener("click", hidePopup)
  buttons.forEach((button: any) => {
    // @ts-ignore
    top?.document
      ?.querySelector(`.plugin-git-${button?.key}`)
      ?.addEventListener("click", operations?.[button!?.event])
  })
}

const renderButtons = (operations?: Record<string, any>) => {
  if (canAccessTopDocument()) {
    renderButtonsLegacy(operations)
  } else {
    renderButtonsProvideUI(operations)
  }
}

if (isDevelopment) {
  renderApp("browser");
} else {
  console.log("=== logseq-plugin-git loaded ===");
  logseq.ready(() => {
    const operations = {
      check: debounce(async function () {
        const status = await checkStatus();
        if (status?.stdout === "") {
          logseq.UI.showMsg("No changes detected.");
        } else {
          logseq.UI.showMsg("Changes detected:\n" + status.stdout, "success", {
            timeout: 0,
          });
        }
        hidePopup();
      }),
      pull: debounce(async function () {
        console.log("[faiz:] === pull click");
        setPluginStyle(LOADING_STYLE);
        hidePopup();
        await pull(false);
        checkStatus();
      }),
      pullRebase: debounce(async function () {
        console.log("[faiz:] === pullRebase click");
        setPluginStyle(LOADING_STYLE);
        hidePopup();
        await pullRebase();
        checkStatus();
      }),
      checkout: debounce(async function () {
        console.log("[faiz:] === checkout click");
        hidePopup();
        checkout();
      }),
      commit: debounce(async function () {
        hidePopup();
        await commit(true, commitMessage());
        checkStatus();
      }),
      push: debounce(async function () {
        setPluginStyle(LOADING_STYLE);
        hidePopup();
        await push();
        checkStatus();
      }),
      commitAndPush: debounce(async function () {
        setPluginStyle(LOADING_STYLE);
        hidePopup();

        const status = await checkStatus();
        const changed = status?.stdout !== "";
        if (changed) {
          const res = await commit(
              true,
              commitMessage()
          );
          if (res.exitCode === 0) await push(true);
        }
        checkStatus();
      }),
      log: debounce(async function () {
        console.log("[faiz:] === log click");
        const res = await log(false);
        logseq.UI.showMsg(res?.stdout, "success", { timeout: 0 });
        hidePopup();
      }),
      showPopup: debounce(async function () {
        console.log("[faiz:] === showPopup click");
        renderButtons(operations);
        showPopup();
      }),
      hidePopup: debounce(function () {
        console.log("[faiz:] === hidePopup click");
        hidePopup();
      }),
    };


    const autoPushDebounced = debounce(() => {
      if (logseq.settings?.autoPush) {
        console.log("[logseq-git] autoPush (debounced)");
        operations.commitAndPush();
      }
    }, 15000);

    logseq.provideModel(operations);

    logseq.App.registerUIItem("toolbar", {
      key: "git",
      template:
        '<a data-on-click="showPopup" class="button"><i class="ti ti-brand-git"></i></a><div id="plugin-git-content-wrapper"></div>',
    });
    logseq.useSettingsSchema(SETTINGS_SCHEMA);
    setTimeout(() => {
      const buttons = (logseq.settings?.buttons as string[])
        ?.map((title) => BUTTONS.find((b) => b.title === title))
        .filter(Boolean);
      if (top && buttons?.length) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(
          `
          <div class="plugin-git-container">
            <div class="plugin-git-mask"></div>
            <div class="plugin-git-popup flex flex-col">
              ${buttons
                .map(
                  (button) =>
                    `<button class="ui__button plugin-git-${button?.key} bg-indigo-600 hover:bg-indigo-700 focus:border-indigo-700 active:bg-indigo-700 text-center text-sm p-1" style="margin: 4px 0; color: #fff;">${button?.title}</button>`
                )
                .join("\n")}
          </div>
          `,
          "text/html"
        );
        // remove .plugin-git-container if exists
        const container = top?.document?.querySelector(".plugin-git-container");
        console.log("[faiz:] === container", container);
        if (container) top?.document?.body.removeChild(container);
        top?.document?.body.appendChild(
          doc.body.childNodes?.[0]?.cloneNode(true)
        );
        top?.document
          ?.querySelector(".plugin-git-mask")
          ?.addEventListener("click", hidePopup);
        buttons.forEach((button) => {
          top?.document
            ?.querySelector(`.plugin-git-${button?.key}`)
            ?.addEventListener("click", operations?.[button!?.event]);
        });
      }
    }, 1000);

    logseq.App.onRouteChanged(async () => {
      checkStatusWithDebounce();
      if (logseq.settings?.autoPush) autoPushDebounced();
    });
    if (logseq.settings?.checkWhenDBChanged) {
      logseq.DB.onChanged(({ blocks, txData, txMeta }) => {
        checkStatusWithDebounce();
        if (logseq.settings?.autoPush) autoPushDebounced();
      });
    }

    if (logseq.settings?.autoCheckSynced) checkIsSynced();
    checkStatusWithDebounce();

    const autoFetchIntervalSeconds =
      (logseq.settings?.autoFetchIntervalSeconds as number | undefined) ?? 0;
    if (autoFetchIntervalSeconds > 0) {
      const intervalMs = Math.max(autoFetchIntervalSeconds, 5) * 1000;
      fetchAndMaybeAutoPull();
      setInterval(() => {
        fetchAndMaybeAutoPull();
      }, intervalMs);
    }

    document.addEventListener("visibilitychange", async () => {
      const visibilityState = document.visibilityState;

      if (visibilityState === "visible") {
        if (logseq.settings?.autoCheckSynced) checkIsSynced();
        if (
          autoFetchIntervalSeconds > 0 ||
          logseq.settings?.autoPullWhenRemoteChanged
        ) {
          fetchAndMaybeAutoPull();
        }
      } else if (visibilityState === "hidden") {
        if (logseq.settings?.autoPush) {
          autoPushDebounced();
        }
      }
    });

    window.addEventListener("blur", () => {
      if (logseq.settings?.autoPush) {
        autoPushDebounced();
      }
    });

    window.addEventListener("focus", () => {
      if (logseq.settings?.autoCheckSynced) checkIsSynced();
      if (
        autoFetchIntervalSeconds > 0 ||
        logseq.settings?.autoPullWhenRemoteChanged
      ) {
        fetchAndMaybeAutoPull();
      }
    });

    if (top) {
      top.document?.addEventListener("visibilitychange", async () => {
        const visibilityState = top?.document?.visibilityState;

        if (visibilityState === "visible") {
          if (logseq.settings?.autoCheckSynced) checkIsSynced();
          if (
            autoFetchIntervalSeconds > 0 ||
            logseq.settings?.autoPullWhenRemoteChanged
          ) {
            fetchAndMaybeAutoPull();
          }
        } else if (visibilityState === "hidden") {
          // logseq.UI.showMsg(`Page is hidden: ${new Date()}`, 'success', { timeout: 0 })
          // noChange void
          // changed commit push
          if (logseq.settings?.autoPush) {
            operations.commitAndPush();
          }
        }
      });
    }

    logseq.App.registerCommandPalette(
      {
        key: "logseq-plugin-git:commit",
        label: "Commit",
        keybinding: {
          binding: "alt+shift+s",
          mode: "global",
        },
      },
      () => operations.commit()
    );
    logseq.App.registerCommandPalette(
      {
        key: "logseq-plugin-git:commit&push",
        label: "Commit & Push",
        keybinding: {
          binding: "mod+s",
          mode: "global",
        },
      },
      () => operations.commitAndPush()
    );
    logseq.App.registerCommandPalette(
        {
          key: "logseq-plugin-git:rebase",
          label: "Pull Rebase",
          keybinding: {
            binding: "mod+alt+s",
            mode: "global",
          },
        },
        () => operations.pullRebase()
    );
  });
}

function renderApp(env: string) {
  ReactDOM.render(
    <React.StrictMode>
      <App env={env} />
    </React.StrictMode>,
    document.getElementById("root")
  );
}
