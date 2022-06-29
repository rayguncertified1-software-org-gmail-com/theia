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
    override layout: PanelLayout;

    protected pageAndTreeLayout: ViewContainerLayout | undefined;

    // serves as an empty container so that different view containers can be swapped out
    protected terminalPanelWrapper = new Panel({
        layout: new PanelLayout(),
    });

    @postConstruct()
    protected async init(): Promise<void> {
        this.toDispose.push(this.treeWidget.model.onTreeSelectionChanged(changeEvent => this.handleSelectionChange(changeEvent)));

        this.toDispose.push(this.treeWidget.model.onPageAdded(pageNode => this.handlePageAdded(pageNode)));

        this.toDispose.push(this.treeWidget.model.onTerminalGroupAdded(groupNode => this.handleTerminalGroupAdded(groupNode)));

        this.toDispose.push(this.treeWidget.model.onTerminalAddedToGroup(terminalNode => this.handleWidgetAddedToTerminalGroup(terminalNode)));

        this.toDispose.push(this.shell.onDidChangeActiveWidget(({ newValue }) => this.handleOnDidChangeActiveWidget(newValue)));
        this.title.iconClass = codicon('terminal-tmux');
        this.id = TerminalManagerWidget.ID;
        this.title.closable = false;
        this.title.label = TerminalManagerWidget.LABEL;

        this.createPageAndTreeLayout();
        await this.commandService.executeCommand(TerminalCommands.MANAGER_NEW_PAGE_TOOLBAR.id);
    }

    protected createPageAndTreeLayout(): void {
        this.layout = new PanelLayout();
        this.pageAndTreeLayout = new ViewContainerLayout({
            renderer: SplitPanel.defaultRenderer,
            orientation: 'horizontal',
            spacing: 2,
            headerSize: 0,
            animationDuration: 200
        }, this.splitPositionHandler);
        this.panel = new SplitPanel({
            layout: this.pageAndTreeLayout,
        });

        this.layout.addWidget(this.panel);
        this.pageAndTreeLayout.addWidget(this.terminalPanelWrapper);
        this.pageAndTreeLayout.addWidget(this.treeWidget);
    }

    initializePanelSizes(): void {
        // this.pageAndTreeLayout?.setPartSizes([60, 15]);
    }

    addTerminalPage(widget: Widget): void {
        if (widget instanceof TerminalWidgetImpl) {
            const groupPanel = this.createTerminalGroupPanel();
            groupPanel.id = `group-${widget.id}`;
            groupPanel.addWidget(widget);
            const pagePanel = this.createPagePanel();
            pagePanel.id = `page-${groupPanel.id}`;
            pagePanel.addWidget(groupPanel);
            // const groupPanel = existingGroupPanel ?? this.createTerminalGroupPanel(widget);
            // const pagePanel = existingPagePanel ?? this.createPagePanel(groupPanel);
            return this.treeWidget.model.addTerminalPage(widget, groupPanel, pagePanel);
        }
    }

    // protected createPagePanel(groupPanel: SplitPanel): SplitPanel {
    protected createPagePanel(): SplitPanel {
        const newPageLayout = new ViewContainerLayout({
            renderer: SplitPanel.defaultRenderer,
            orientation: 'horizontal',
            spacing: 2,
            headerSize: 0,
            animationDuration: 200
        }, this.splitPositionHandler);
        const newPagePanel = new SplitPanel({
            layout: newPageLayout,
        });
        newPagePanel.node.tabIndex = -1;
        // newPagePanel.id = `page-${groupPanel.id}`;
        // newPageLayout.addWidget(groupPanel);
        return newPagePanel;
    }

    protected handlePageAdded(pageNode: TerminalManagerTreeTypes.PageNode): void {
        const { panel } = pageNode;
        (this.terminalPanelWrapper.layout as PanelLayout).addWidget(panel);
        this.update();
    }

    addTerminalGroupToPage(widget: Widget): void {
        if (widget instanceof TerminalWidgetImpl) {
            // const groupPanel = this.createTerminalGroupPanel(widget);
            const groupPanel = this.createTerminalGroupPanel();
            groupPanel.id = `group-${widget.id}`;
            groupPanel.addWidget(widget);
            this.treeWidget.model.addTerminalGroup(widget, groupPanel);
        }
    }

    // protected createTerminalGroupPanel(terminalWidget: Widget): SplitPanel {
    protected createTerminalGroupPanel(): SplitPanel {
        const terminalColumnLayout = new ViewContainerLayout({
            renderer: SplitPanel.defaultRenderer,
            orientation: 'vertical',
            spacing: 0,
            headerSize: 0,
            animationDuration: 200,
            alignment: 'end',
        }, this.splitPositionHandler);
        const terminalColumnPanel = new SplitPanel({
            layout: terminalColumnLayout,
        });
        terminalColumnPanel.node.tabIndex = -1;
        // terminalColumnPanel.id = `group-${terminalWidget.id}`;
        // terminalColumnLayout.addWidget(terminalWidget);
        return terminalColumnPanel;
    }

    protected handleTerminalGroupAdded(groupNode: TerminalManagerTreeTypes.TerminalGroupNode): void {
        const { panel } = groupNode;
        const activePage = this.treeWidget.model.activePage?.panel;
        if (activePage) {
            activePage.addWidget(panel);
            this.update();
        }
    }

    addWidgetToTerminalGroup(widget: Widget, terminalId: TerminalManager.TerminalID): void {
        if (widget instanceof TerminalWidgetImpl) {
            this.treeWidget.model.addTerminal(widget, terminalId);
        }
    }

    protected handleWidgetAddedToTerminalGroup(terminalNode: TerminalManagerTreeTypes.TerminalNode): void {
        const groupNode = terminalNode.parent;
        console.log('SENTINEL GOT PAGE NODE', groupNode);
        if (TerminalManagerTreeTypes.isTerminalGroupNode(groupNode)) {
            const { panel } = groupNode;
            panel.addWidget(terminalNode.widget);
            this.update();
        }
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

    protected handleSelectionChange(changeEvent: TerminalManagerTreeTypes.SelectionChangedEvent): void {
        const { activePage, activeTerminal } = changeEvent;
        const layout = (this.panel.layout as ViewContainerLayout);
        console.log('SENTINEL PART SIZES', layout.widgets.map(widget => layout.getPartSize(widget)));
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

    protected async updateViewPage(activePage: TerminalManagerTreeTypes.PageNode, panel?: SplitPanel): Promise<void> {
        // const activePanel = panel ?? this.pageNodeToPanelMap.get(activePage);
        const activePanel = panel ?? activePage.panel;
        if (activePanel) {
            (this.terminalPanelWrapper.layout as PanelLayout).widgets.forEach(widget => this.terminalPanelWrapper.layout?.removeWidget(widget));
            (this.terminalPanelWrapper.layout as PanelLayout).addWidget(activePanel);
            this.update();
        }
    }

    deleteTerminal(terminalNode: TerminalManagerTreeTypes.TerminalNode): void {
        this.treeWidget.model.deleteTerminalNode(terminalNode);
    }

    deleteGroup(groupNode: TerminalManagerTreeTypes.TerminalGroupNode): void {
        this.treeWidget.model.deleteTerminalGroup(groupNode);
    }

    deletePage(pageNode: TerminalManagerTreeTypes.PageNode): void {
        this.treeWidget.model.deleteTerminalPage(pageNode);
    }

    toggleRenameTerminal(node: TerminalManagerTreeTypes.TerminalManagerTreeNode): void {
        this.treeWidget.toggleRenameTerminal(node);
    }

    getLayoutData(): TerminalManager.LayoutData {
        let layoutData = this.treeWidget.model.getLayoutData();
        const pageAndPanelRelativeSizes = this.pageAndTreeLayout?.relativeSizes();
        // layoutData = { ...layoutData, pageWidth, treeWidth, treeWidget: this.treeWidget };
        layoutData = { ...layoutData, pageAndPanelRelativeSizes };
        return layoutData;
    }

    setLayoutData(layoutData: TerminalManager.LayoutData): void {
        const { pageAndPanelRelativeSizes, items } = layoutData;
        if (pageAndPanelRelativeSizes) {
            this.pageAndTreeLayout?.setRelativeSizes(pageAndPanelRelativeSizes);
        } else {
            this.pageAndTreeLayout?.setPartSizes([60, 15]);
        }
        const pageLayouts = items?.pageLayouts;
        if (pageLayouts) {
            for (let pageIndex = 0; pageIndex < pageLayouts.length; pageIndex++) {
                const pageLayout = pageLayouts[pageIndex];
                const pagePanel = this.createPagePanel();
                this.terminalPanelWrapper.addWidget(pagePanel);
                const { groupLayouts } = pageLayout;
                for (let groupIndex = 0; groupIndex < groupLayouts.length; groupIndex++) {
                    const groupLayout = groupLayouts[groupIndex];
                    const groupPanel = this.createTerminalGroupPanel();
                    pagePanel.id = `page-${groupPanel.id}`;
                    pagePanel.addWidget(groupPanel);
                    const { widgetLayouts } = groupLayout;
                    for (let widgetIndex = 0; widgetIndex < widgetLayouts.length; widgetIndex++) {
                        const widgetLayout = widgetLayouts[widgetIndex];
                        const { widget } = widgetLayout;
                        groupPanel.addWidget(widget);
                    }
                }
            }
        }
        // const treeWidget = layoutData.treeWidget;
        // console.log('SENTINEL GOT TREEWIDGET BACK', treeWidget);
        // eslint-disable-next-line no-null/no-null
        // this.tabBar.currentTitle = null;

        // let currentTitle: Title<Widget> | undefined;
        // if (layoutData.items) {
        //     for (const { widget, rank, expanded, pinned } of layoutData.items) {
        //         if (widget) {
        //             if (rank) {
        //                 SidePanelHandler.rankProperty.set(widget, rank);
        //             }
        //             if (expanded) {
        //                 currentTitle = widget.title;
        //             }
        //             if (pinned) {
        //                 widget.title.className += ' theia-mod-pinned';
        //                 widget.title.closable = false;
        //             }
        //             // Add the widgets directly to the tab bar in the same order as they are stored
        //             this.tabBar.addTab(widget.title);
        //         }
        //     }
        // }
        // if (layoutData.size) {
        //     this.state.lastPanelSize = layoutData.size;
        // }

        // // If the layout data contains an expanded item, update the currentTitle property
        // // This implies a refresh through the `currentChanged` signal
        // if (currentTitle) {
        //     this.tabBar.currentTitle = currentTitle;
        // } else {
        //     this.refresh();
        // }
    }
}
