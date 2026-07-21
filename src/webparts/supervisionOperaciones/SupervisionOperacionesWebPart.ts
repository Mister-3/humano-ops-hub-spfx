import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { SPFx, spfi } from '@pnp/sp';

import SupervisionOperaciones from './components/SupervisionOperaciones';
import GraphService from './services/GraphService';
import { setSP } from './services/pnpjsConfig';

export type ISupervisionOperacionesWebPartProps = Record<string, never>;

export default class SupervisionOperacionesWebPart
  extends BaseClientSideWebPart<ISupervisionOperacionesWebPartProps> {

  private graphService!: GraphService;

  protected async onInit(): Promise<void> {
    await super.onInit();

    const sp = spfi().using(SPFx(this.context));
    setSP(sp);
    this.graphService = new GraphService(this.context);
  }

  public render(): void {
    const element: React.ReactElement = React.createElement(
      SupervisionOperaciones,
      { graphService: this.graphService }
    );

    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }
}
