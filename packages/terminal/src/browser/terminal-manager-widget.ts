// *****************************************************************************
// Copyright (C) 2022 Ericsson and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable, interfaces, postConstruct } from '@theia/core/shared/inversify';
import {
    BaseWidget,
    codicon,
    DockPanelRenderer,
    DockPanelRendererFactory,
    Panel,
    PanelLayout,
    SplitLayout,
    SplitPanel,
    SplitPositionHandler,
    ViewContainerLayout,
} from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';
import { TerminalManagerTreeWidget } from './terminal-manager-tree-widget';
import { TerminalWidgetImpl } from './terminal-widget-impl';
import { CommandService } from '@theia/core';
import { TerminalCommands } from './terminal-frontend-contribution';
import { TerminalManagerTreeTypes, TerminalManager } from './terminal-manager-types';

@injectable()
export class TerminalManagerWidget extends BaseWidget {
    static ID = 'terminal-manager-widget';
    static LABEL = 'Terminal';

    static createContainer(parent: interfaces.Container): interfaces.Container {
        const child = parent.createChild();
        child.bind(TerminalManagerTreeWidget).toDynamicValue(context => TerminalManagerTreeWidget.createWidget(child));
        child.bind(TerminalManagerWidget).toSelf().inSingletonScope();
        return child;
    }

    static createWidget(parent: interfaces.Container): TerminalManagerWidget {
        return TerminalManagerWidget.createContainer(parent).get(TerminalManagerWidget);
    }

    protected panel: SplitPanel;
    _widgets: TerminalWidgetImpl[] = [];

    get widgets(): TerminalWidgetImpl[] {
        return (this.panel.layout as SplitLayout)?.widgets
            .filter((widget): widget is TerminalWidgetImpl => widget instanceof TerminalWidgetImpl);
    }

    @inject(SplitPositionHandler)
    protected readonly splitPositionHandler: SplitPositionHandler;

    @inject(TerminalManagerTreeWidget) protected readonly treeWidget: TerminalManagerTreeWidget;
    @inject(DockPanelRendererFactory) protected dockPanelRendererFactory: () => DockPanelRenderer;

    @inject(CommandService) protected readonly commandService: CommandService;

    protected terminalPanels: SplitPanel[] = [];
    protected activePage: TerminalManagerTreeTypes.PageNode | undefined;
    // protected pageNodeToPanelMap = new Map<TerminalManagerTreeTypes.PageNode, SplitPanel>();
    override layout: PanelLayout;

    // serves as an empty container so that different view containers can be swapped out
    protected terminalPanelWrapper = new Panel({
        layout: new PanelLayout(),
    });

    @postConstruct()
    protected async init(): Promise<void> {
        // this.toDispose.push(this.treeWidget.onDidChange(() => this.updateViewPage()));
        this.toDispose.push(this.treeWidget.model.onTreeSelectionChanged(({ activePage, activeTerminal }) => this.handleSelectionChange(activePage, activeTerminal)));
        this.toDispose.push(this.treeWidget.model.onPageAdded(pageNode => this.handlePageAdded(pageNode)));
        this.toDispose.push(this.treeWidget.model.onPageRemoved(pageNode => this.handlePageRemoved(pageNode)));
        this.toDispose.push(this.treeWidget.model.onTerminalAdded(terminalNode => this.handleTerminalAdded(terminalNode)));
        this.toDispose.push(this.treeWidget.model.onTerminalRemoved(terminalNode => this.handleTerminalRemoved(terminalNode)));
        this.toDispose.push(this.treeWidget.model.onTerminalSplit(groupNode => this.handleTerminalSplit(groupNode)));
        this.title.iconClass = codicon('terminal-tmux');
        this.id = TerminalManagerWidget.ID;
        this.title.closable = false;
        this.title.label = TerminalManagerWidget.LABEL;

        this.layout = new PanelLayout();
        this.panel = new SplitPanel({
            layout: new ViewContainerLayout({
                renderer: SplitPanel.defaultRenderer,
                orientation: 'horizontal',
                spacing: 2,
                headerSize: 0,
                animationDuration: 200
            }, this.splitPositionHandler),
        });
        this.layout.addWidget(this.panel);
        (this.panel.layout as ViewContainerLayout).addWidget(this.terminalPanelWrapper);
        (this.panel.layout as ViewContainerLayout).addWidget(this.treeWidget);
        // ({
        //     renderer: SplitPanel.defaultRenderer,
        //     orientation: 'horizontal',
        //     spacing: 2,
        //     headerSize: 0,
        //     animationDuration: 200
        // }, this.splitPositionHandler);
        // this.terminalLayout = new GridLayout();
        this.addTerminalPage();
        // this.layout.addWidget(this.treeWidget);
    }

    protected async handlePageAdded(pageNode: TerminalManagerTreeTypes.PageNode): Promise<SplitPanel> {
        const newPageLayout = new ViewContainerLayout({
            renderer: SplitPanel.defaultRenderer,
            orientation: 'horizontal',
            spacing: 2,
            headerSize: 0,
            animationDuration: 200
        }, this.splitPositionHandler);
        // necessary because a panel extends Widget
        const newPagePanel = new SplitPanel({
            layout: newPageLayout,
        });
        newPagePanel.id = pageNode.id;
        newPagePanel.node.tabIndex = -1;
        pageNode.panel = newPagePanel;
        // this.pageNodeToPanelMap.set(pageNode, newPagePanel);
        this.updateViewPage(pageNode, newPagePanel);
        await this.commandService.executeCommand(TerminalCommands.MANAGER_NEW_TERMINAL.id);
        return newPagePanel;
    }

    protected handlePageRemoved(pageNode: TerminalManagerTreeTypes.PageNode): void {
        pageNode.panel?.dispose();
        // const panel = this.pageNodeToPanelMap.get(pageNode);
        // if (panel) {
        //     panel.dispose();
        // }
    }

    protected handleTerminalAdded(terminalNode: TerminalManagerTreeTypes.TerminalNode): void {
        const { panel } = this.treeWidget.model.activePage;
        // const activePanel = this.pageNodeToPanelMap.get(this.treeWidget.model.activePage);
        if (panel) {
            panel.addWidget(terminalNode.widget);
        }
    }

    // protected createNewTerminalColumn(terminalNode: TerminalManagerTreeTypes.TerminalNode): void {
    //     const terminalColumnLayout = new ViewContainerLayout({
    //         renderer: SplitPanel.defaultRenderer,
    //         orientation: 'horizontal',
    //         spacing: 2,
    //         headerSize: 0,
    //         animationDuration: 200
    //     }, this.splitPositionHandler);
    //     // necessary because a panel extends Widget
    //     const terminalColumnPanel = new SplitPanel({
    //         layout: terminalColumnLayout,
    //     });
    //     terminalColumnPanel.id = terminalNode.id;
    //     terminalColumnPanel.node.tabIndex = -1;

    //     this.pageNodeToPanelMap.set(terminalNode, terminalColumnPanel);
    //     this.updateViewPage(pageNode, terminalColumnPanel);
    // }

    protected handleTerminalSplit(groupNode: TerminalManagerTreeTypes.TerminalGroupNode): void {

    }

    protected handleTerminalRemoved(terminalNode: TerminalManagerTreeTypes.TerminalNode): void {
        const { widget } = terminalNode;
        widget.dispose();
    }

    protected async updateViewPage(activePage: TerminalManagerTreeTypes.PageNode, panel?: SplitPanel): Promise<void> {
        // const activePanel = panel ?? this.pageNodeToPanelMap.get(activePage);
        const activePanel = panel ?? activePage.panel;
        if (activePanel) {
            (this.terminalPanelWrapper.layout as PanelLayout).widgets.forEach(widget => this.terminalPanelWrapper.layout?.removeWidget(widget));
            (this.terminalPanelWrapper.layout as PanelLayout).addWidget(activePanel);
            this.update();
        }
    }

    protected handleSelectionChange(activePage: TerminalManagerTreeTypes.PageNode, _activeTerminal: TerminalManagerTreeTypes.TerminalNode): void {
        if (activePage !== this.activePage) {
            this.activePage = activePage;
            this.title.label = `Emux: ${this.activePage.label}`;
            this.updateViewPage(activePage);
        }
    }

    addTerminalPage(): TerminalManagerTreeTypes.PageNode | undefined {
        return this.treeWidget.model.addPage();
    }

    addWidget(widget: TerminalWidget): void {
        this.treeWidget.model.addWidget(widget);
    }

    deleteTerminal(terminalNode: TerminalManagerTreeTypes.TerminalNode): void {
        this.treeWidget.model.deleteTerminalNode(terminalNode);
    }

    deletePage(pageNode: TerminalManagerTreeTypes.PageNode): void {
        this.treeWidget.model.deletePageNode(pageNode);
    }

    splitWidget(terminalWidget: TerminalWidget, parentId: TerminalManager.TerminalID): void {
        this.treeWidget.model.splitTerminalHorizontally(terminalWidget, parentId);
        console.log('SENTINEL TERMINAL WIDGET', terminalWidget, parentId);
    }

    toggleRenameTerminal(terminalNode: TerminalManagerTreeTypes.TreeNode): void {
        this.treeWidget.toggleRenameTerminal(terminalNode);
    }
}
