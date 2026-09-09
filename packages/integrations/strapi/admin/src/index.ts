import { Initializer } from "./components/Initializer";
import { PluginIcon } from "./components/PluginIcon";
import { PLUGIN_ID } from "./pluginId";

export default {
  register(app: any) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: "Strapi 5 Plugin for Creem",
      },
      Component: async () => {
        const { App } = await import("./pages/App");
        return App;
      },
    });
    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: "Strapi 5 Plugin for Creem",
    });
    app.createSettingSection(
      {
        id: PLUGIN_ID,
        intlLabel: {
          id: `${PLUGIN_ID}.settings.section`,
          defaultMessage: "Creem",
        },
      },
      [
        {
          id: PLUGIN_ID,
          intlLabel: {
            id: `${PLUGIN_ID}.settings.title`,
            defaultMessage: "Configuration",
          },
          to: `/settings/${PLUGIN_ID}`,
          Component: async () => import("./pages/SettingsPage"),
          permissions: [],
        },
      ],
    );
  },
  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);
          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      }),
    );
  },
};
