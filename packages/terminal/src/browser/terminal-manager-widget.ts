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
    ApplicationShell,
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
    Widget,
} from '@theia/core/lib/browser';
import { TerminalManagerTreeWidget } from './terminal-manager-tree-widget';
import { TerminalWidgetImpl } from './terminal-widget-impl';
import { CommandService } from '@theia/core';
import { TerminalCommands } from './terminal-frontend-contribution';
import { TerminalManager, TerminalManagerTreeTypes } from './terminal-manager-types';

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
    @inject(ApplicationShell) protected readonly shell: ApplicationShell;
    @inject(CommandService) protected readonly commandService: CommandService;

    protected terminalPanels: SplitPanel[] = [];
    protected activePage: TerminalManagerTreeTypes.PageNode | undefined;
    protected activeTerminal: TerminalManagerTreeTypes.TerminalNode | undefined;
    // protected pageNodeToPanelMap = new Map<TerminalManagerTreeTypes.PageNode, SplitPanel>();
    override layout: PanelLayout;

    // serves as an empty container so that different view containers can be swapped out
    protected terminalPanelWrapper = new Panel({
        layout: new PanelLayout(),
    });

    @postConstruct()
    protected async init(): Promise<void> {
        // this.toDispose.push(this.treeWidget.onDidChange(() => this.updateViewPage()));
        this.toDispose.push(this.treeWidget.model.onTreeSelectionChanged(changeEvent => this.handleSelectionChange(changeEvent)));
        this.toDispose.push(this.treeWidget.model.onPageAdded(pageNode => this.handlePageAdded(pageNode)));
        this.toDispose.push(this.treeWidget.model.onPageRemoved(pageNode => this.handlePageRemoved(pageNode)));
        this.toDispose.push(this.treeWidget.model.onTerminalColumnAdded(terminalNode => this.handleTerminalAdded(terminalNode)));
        this.toDispose.push(this.treeWidget.model.onTerminalRemoved(terminalNode => this.handleTerminalRemoved(terminalNode)));
        this.toDispose.push(this.treeWidget.model.onTerminalSplit(event => this.handleTerminalSplit(event)));
        this.toDispose.push(this.shell.onDidChangeActiveWidget(({ newValue }) => this.handleOnDidChangeActiveWidget(newValue)));
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
        await this.commandService.executeCommand(TerminalCommands.MANAGER_NEW_PAGE_TOOLBAR.id);
        // this.addTerminalPage();
    }

    initializePanelSizes(): void {
        (this.panel.layout as ViewContainerLayout).setPartSizes([60, 15]);
    }

    protected handleOnDidChangeActiveWidget(widget: Widget | null): void {
        if (!(widget instanceof TerminalWidgetImpl)) {
            return;
        }
        const node = this.treeWidget.model.getNode(widget.id);
        if (node && TerminalManagerTreeTypes.isTerminalNode(node)) {
            this.treeWidget.model.selectNode(node);
        }
    }

    protected handlePageRemoved(pageNode: TerminalManagerTreeTypes.PageNode): void {
        pageNode.panel?.dispose();
        // const panel = this.pageNodeToPanelMap.get(pageNode);
        // if (panel) {
        //     panel.dispose();
        // }
    }

    protected handleTerminalAdded(terminalNode: TerminalManagerTreeTypes.TerminalNode): void {
        const { activePage } = this.treeWidget.model;
        if (!activePage) {
            return;
        }
        const { panel } = activePage;
        // const activePanel = this.pageNodeToPanelMap.get(this.treeWidget.model.activePage);
        if (panel) {
            // const newTerminalColumn = this.createNewTerminalColumn(terminalNode);
            // activePagePanel.addWidget(terminalNode.widget);
            panel.addWidget(terminalNode.widget);
        }
    }

    protected createTerminalGroupPanel(terminalWidget: Widget): SplitPanel {
        const terminalColumnLayout = new ViewContainerLayout({
            renderer: SplitPanel.defaultRenderer,
            orientation: 'vertical',
            spacing: 0,
            headerSize: 0,
            animationDuration: 200
        }, this.splitPositionHandler);
        // necessary because a panel extends Widget
        const terminalColumnPanel = new SplitPanel({
            layout: terminalColumnLayout,
        });
        terminalColumnPanel.id = `group-${terminalWidget.id}`;
        terminalColumnPanel.node.tabIndex = -1;
        terminalColumnLayout.addWidget(terminalWidget);
        return terminalColumnPanel;
    }

    protected handleTerminalSplit(event: { groupNode: TerminalManagerTreeTypes.TerminalGroupNode, terminalWidget: Widget }): void {
        // const parentTerminalColumn = event.groupNode.widget;
        // const { terminalWidget } = event;
        // parentTerminalColumn.addWidget(terminalWidget);
        // this.update();
        // // console.log('SENTINEL NEW GROUP NODE', groupNode);
    }

    protected handleTerminalRemoved(terminalNode: TerminalManagerTreeTypes.TerminalNode): void {
        const { widget } = terminalNode;
        widget.dispose();
    }

    protected handleSelectionChange(changeEvent: TerminalManagerTreeTypes.SelectionChangedEvent): void {
        const { activePage, activeTerminal } = changeEvent;
        console.log('SENTINEL SHOULD BE RECEIVING EVENT', activeTerminal);
        if (activePage && activePage !== this.activePage) {
            this.activePage = activePage;
            this.title.label = `EMux: ${this.activePage.label}`;
            this.updateViewPage(activePage);
        }
        if (activeTerminal && activeTerminal !== this.activeTerminal) {
            this.flashActiveTerminal(activeTerminal.widget);
        }
    }

    protected flashActiveTerminal(terminal: Widget): void {
        terminal.addClass('attention');
        setTimeout(() => terminal.removeClass('attention'), 250);
    }

    addTerminalPage(widget: Widget): void {
        if (widget instanceof TerminalWidgetImpl) {
            const groupPanel = this.createTerminalGroupPanel(widget);
            const pagePanel = this.createPagePanel(groupPanel);
            return this.treeWidget.model.addPage(widget, groupPanel, pagePanel);
        }
    }

    protected createPagePanel(groupPanel: SplitPanel): SplitPanel {
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
        newPagePanel.id = `page-${groupPanel.id}`;
        newPagePanel.node.tabIndex = -1;
        newPageLayout.addWidget(groupPanel);
        return newPagePanel;
    }

    protected handlePageAdded(pageNode: TerminalManagerTreeTypes.PageNode): void {
        const { panel } = pageNode;
        (this.terminalPanelWrapper.layout as PanelLayout).addWidget(panel);
        this.update();
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

    addNewWidgetColumn(widget: Widget): void {
        if (widget instanceof TerminalWidgetImpl) {
            const newWidgetColumn = this.createTerminalGroupPanel(widget);
            const groupNode = this.treeWidget.model.createGroupNode(newWidgetColumn);
            const widgetNode = this.treeWidget.model.createTerminalWidgetNode(widget);
            this.treeWidget.model.addNewWidgetColumn(widgetNode, groupNode);
            // this.treeWidget.model.addWidget(widget, groupNode);
        }
    }

    deleteTerminal(terminalNode: TerminalManagerTreeTypes.TerminalNode): void {
        this.treeWidget.model.deleteTerminalNode(terminalNode);
    }

    deleteGroup(groupNode: TerminalManagerTreeTypes.TerminalGroupNode): void {
        this.treeWidget.model.deleteGroupNode(groupNode);
    }

    deletePage(pageNode: TerminalManagerTreeTypes.PageNode): void {
        this.treeWidget.model.deletePageNode(pageNode);
    }

    splitWidget(terminalWidget: Widget, parentId: TerminalManager.TerminalID): void {
        // this.treeWidget.model.splitTerminalHorizontally(terminalWidget, parentId);
        console.log('SENTINEL TERMINAL WIDGET', terminalWidget, parentId);
    }

    toggleRenameTerminal(node: TerminalManagerTreeTypes.TerminalManagerTreeNode): void {
        this.treeWidget.toggleRenameTerminal(node);
    }
}
