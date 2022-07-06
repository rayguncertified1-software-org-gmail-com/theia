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
    CompositeTreeNode,
    DockPanelRenderer,
    DockPanelRendererFactory,
    Panel,
    PanelLayout,
    SplitPanel,
    SplitPositionHandler,
    ViewContainerLayout,
    Widget,
} from '@theia/core/lib/browser';
import { TerminalManagerTreeWidget } from './terminal-manager-tree-widget';
import { TerminalWidgetImpl } from './terminal-widget-impl';
import { CommandService, Emitter } from '@theia/core';
import { UUID } from '@theia/core/shared/@phosphor/coreutils';
import { TerminalManager, TerminalManagerCommands, TerminalManagerTreeTypes } from './terminal-manager-types';
import { TerminalWidget } from './base/terminal-widget';

@injectable()
export class TerminalManagerWidget extends BaseWidget implements ApplicationShell.TrackableWidgetProvider {
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

    @inject(SplitPositionHandler)
    protected readonly splitPositionHandler: SplitPositionHandler;

    @inject(TerminalManagerTreeWidget) protected readonly treeWidget: TerminalManagerTreeWidget;
    @inject(DockPanelRendererFactory) protected dockPanelRendererFactory: () => DockPanelRenderer;
    @inject(ApplicationShell) protected readonly shell: ApplicationShell;
    @inject(CommandService) protected readonly commandService: CommandService;

    protected activePageId: TerminalManagerTreeTypes.PageId | undefined;
    protected activeTerminalId: TerminalManagerTreeTypes.TerminalId | undefined;
    override layout: PanelLayout;
    protected panel: SplitPanel;

    protected pageAndTreeLayout: ViewContainerLayout | undefined;
    protected layoutWasRestored = false;

    protected pagePanels = new Map<TerminalManagerTreeTypes.PageId, TerminalManagerTreeTypes.PageSplitPanel>();
    protected groupPanels = new Map<TerminalManagerTreeTypes.GroupId, TerminalManagerTreeTypes.GroupSplitPanel>();
    protected terminalWidgets = new Map<TerminalManagerTreeTypes.TerminalId, TerminalWidget>();

    protected readonly onDidChangeTrackableWidgetsEmitter = new Emitter<Widget[]>();
    readonly onDidChangeTrackableWidgets = this.onDidChangeTrackableWidgetsEmitter.event;

    // serves as an empty container so that different view containers can be swapped out
    protected terminalPanelWrapper = new Panel({
        layout: new PanelLayout(),
    });

    @postConstruct()
    protected async init(): Promise<void> {
        this.toDispose.push(this.treeWidget.model.onTreeSelectionChanged(changeEvent => this.handleSelectionChange(changeEvent)));

        this.toDispose.push(this.treeWidget.model.onPageAdded(pageId => this.handlePageAdded(pageId)));
        this.toDispose.push(this.treeWidget.model.onPageDeleted(pageId => this.handlePageDeleted(pageId)));

        this.toDispose.push(this.treeWidget.model.onTerminalGroupAdded(groupId => this.handleTerminalGroupAdded(groupId)));
        this.toDispose.push(this.treeWidget.model.onTerminalGroupDeleted(groupId => this.handleTerminalGroupDeleted(groupId)));

        this.toDispose.push(this.treeWidget.model.onTerminalAddedToGroup(({ terminalId, groupId }) => this.handleWidgetAddedToTerminalGroup(terminalId, groupId)));
        this.toDispose.push(this.treeWidget.model.onTerminalDeletedFromGroup(({ terminalId, groupId: groupId }) => this.handleTerminalDeleted(terminalId, groupId)));

        this.toDispose.push(this.shell.onDidChangeActiveWidget(({ newValue }) => this.handleOnDidChangeActiveWidget(newValue)));
        this.title.iconClass = codicon('terminal-tmux');
        this.id = TerminalManagerWidget.ID;
        this.title.closable = true;
        this.title.label = TerminalManagerWidget.LABEL;

        this.createPageAndTreeLayout();
        await this.commandService.executeCommand(TerminalManagerCommands.MANAGER_NEW_PAGE_TOOLBAR.id);
        this.pageAndTreeLayout?.setPartSizes([60, 15]);
    }

    getTrackableWidgets(): Widget[] {
        return Array.from(this.terminalWidgets.values());
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

    addTerminalPage(widget: Widget): void {
        const terminalId = widget.id;
        if (widget instanceof TerminalWidgetImpl && TerminalManagerTreeTypes.isTerminalID(terminalId)) {
            this.terminalWidgets.set(terminalId, widget);
            const groupPanel = this.createTerminalGroupPanel();
            groupPanel.addWidget(widget);
            const pagePanel = this.createPagePanel();
            pagePanel.addWidget(groupPanel);
            // const groupPanel = existingGroupPanel ?? this.createTerminalGroupPanel(widget);
            // const pagePanel = existingPagePanel ?? this.createPagePanel(groupPanel);
            return this.treeWidget.model.addTerminalPage(terminalId, groupPanel.id, pagePanel.id);
        }
    }

    protected createPagePanel(): TerminalManagerTreeTypes.PageSplitPanel {
        const newPageLayout = new ViewContainerLayout({
            renderer: SplitPanel.defaultRenderer,
            orientation: 'horizontal',
            spacing: 2,
            headerSize: 0,
            animationDuration: 200
        }, this.splitPositionHandler);
        const pagePanel = new SplitPanel({
            layout: newPageLayout,
        }) as TerminalManagerTreeTypes.PageSplitPanel;
        const uuid = UUID.uuid4();
        pagePanel.node.tabIndex = -1;
        pagePanel.id = `page-${uuid}`;
        this.pagePanels.set(pagePanel.id, pagePanel);

        return pagePanel;
    }

    protected handlePageAdded(pageId: TerminalManagerTreeTypes.PageId): void {
        const pagePanel = this.pagePanels.get(pageId);
        if (pagePanel) {
            (this.terminalPanelWrapper.layout as PanelLayout).addWidget(pagePanel);
            this.update();
        }
    }

    protected handlePageDeleted(pagePanelId: TerminalManagerTreeTypes.PageId): void {
        this.pagePanels.get(pagePanelId)?.dispose();
        this.pagePanels.delete(pagePanelId);
    }

    addTerminalGroupToPage(widget: Widget): void {
        const terminalId = widget.id;
        if (widget instanceof TerminalWidgetImpl && TerminalManagerTreeTypes.isTerminalID(terminalId)) {
            // const groupPanel = this.createTerminalGroupPanel(widget);
            this.terminalWidgets.set(terminalId, widget);
            const groupPanel = this.createTerminalGroupPanel();
            groupPanel.addWidget(widget);
            this.treeWidget.model.addTerminalGroup(terminalId, groupPanel.id);
        }
    }

    protected createTerminalGroupPanel(): TerminalManagerTreeTypes.GroupSplitPanel {
        const terminalColumnLayout = new ViewContainerLayout({
            renderer: SplitPanel.defaultRenderer,
            orientation: 'vertical',
            spacing: 0,
            headerSize: 0,
            animationDuration: 200,
            alignment: 'end',
        }, this.splitPositionHandler);
        const groupPanel = new SplitPanel({
            layout: terminalColumnLayout,
        }) as TerminalManagerTreeTypes.GroupSplitPanel;
        const uuid = UUID.uuid4();
        groupPanel.node.tabIndex = -1;
        groupPanel.id = `group-${uuid}`;
        this.groupPanels.set(groupPanel.id, groupPanel);
        return groupPanel;
    }

    protected handleTerminalGroupAdded(groupId: TerminalManagerTreeTypes.GroupId): void {
        const groupPanel = this.groupPanels.get(groupId);
        const activePagePanelId = this.treeWidget.model.activePage?.id;
        if (!activePagePanelId || !groupPanel) {
            return;
        }
        const activePage = this.pagePanels.get(activePagePanelId);
        if (activePage) {
            activePage.addWidget(groupPanel);
            this.update();
        }
    }

    protected handleTerminalGroupDeleted(groupPanelId: TerminalManagerTreeTypes.GroupId): void {
        this.groupPanels.get(groupPanelId)?.dispose();
        this.groupPanels.delete(groupPanelId);
    }

    addWidgetToTerminalGroup(widget: Widget, siblingTerminalId: TerminalManagerTreeTypes.TerminalId): void {
        const newTerminalId = widget.id;
        if (widget instanceof TerminalWidgetImpl && TerminalManagerTreeTypes.isTerminalID(newTerminalId)) {
            this.terminalWidgets.set(newTerminalId, widget);
            this.onDidChangeTrackableWidgetsEmitter.fire(this.getTrackableWidgets());
            this.treeWidget.model.addTerminal(newTerminalId, siblingTerminalId);
        }
    }

    protected handleWidgetAddedToTerminalGroup(terminalId: TerminalManagerTreeTypes.TerminalId, groupId: TerminalManagerTreeTypes.GroupId): void {
        const terminalWidget = this.terminalWidgets.get(terminalId);
        const group = this.groupPanels.get(groupId);
        if (terminalWidget && group) {
            const groupPanel = this.groupPanels.get(groupId);
            groupPanel?.addWidget(terminalWidget);
            this.update();
        }
    }

    protected handleTerminalDeleted(terminalId: TerminalManagerTreeTypes.TerminalId, groupPanelId: TerminalManagerTreeTypes.GroupId): void {
        const terminalWidget = this.terminalWidgets.get(terminalId);
        terminalWidget?.dispose();
        this.terminalWidgets.delete(terminalId);
        const parentGroupPanel = this.groupPanels.get(groupPanelId);
        if (parentGroupPanel && parentGroupPanel.widgets.length === 0) {
            this.deleteGroup(parentGroupPanel.id);
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
        const { activePageId, activeTerminalId } = changeEvent;
        const layout = (this.panel.layout as ViewContainerLayout);
        console.log('SENTINEL PART SIZES', layout.widgets.map(widget => layout.getPartSize(widget)));
        if (activePageId && activePageId !== this.activePageId) {
            this.activePageId = activePageId;
            const pageNode = this.treeWidget.model.getNode(activePageId);
            if (!TerminalManagerTreeTypes.isPageNode(pageNode)) {
                return;
            }
            this.title.label = `EMux: ${pageNode.label}`;
            this.updateViewPage(activePageId);
        }
        if (activeTerminalId && activeTerminalId !== this.activeTerminalId) {
            this.flashActiveTerminal(activeTerminalId);
        }
    }

    protected flashActiveTerminal(terminalId: TerminalManagerTreeTypes.TerminalId): void {
        const terminal = this.terminalWidgets.get(terminalId);
        terminal?.addClass('attention');
        setTimeout(() => terminal?.removeClass('attention'), 250);
    }

    protected async updateViewPage(activePageId: TerminalManagerTreeTypes.PageId): Promise<void> {
        // const activePanel = panel ?? this.pageNodeToPanelMap.get(activePage);
        const activePagePanel = this.pagePanels.get(activePageId);
        if (activePagePanel) {
            (this.terminalPanelWrapper.layout as PanelLayout).widgets.forEach(widget => this.terminalPanelWrapper.layout?.removeWidget(widget));
            (this.terminalPanelWrapper.layout as PanelLayout).addWidget(activePagePanel);
            this.update();
        }
    }

    deleteTerminal(terminalId: TerminalManagerTreeTypes.TerminalId): void {
        this.treeWidget.model.deleteTerminalNode(terminalId);
    }

    deleteGroup(groupId: TerminalManagerTreeTypes.GroupId): void {
        this.treeWidget.model.deleteTerminalGroup(groupId);
    }

    deletePage(pageNode: TerminalManagerTreeTypes.PageId): void {
        this.treeWidget.model.deleteTerminalPage(pageNode);
    }

    toggleRenameTerminal(entityId: TerminalManagerTreeTypes.TerminalManagerValidId): void {
        this.treeWidget.model.toggleRenameTerminal(entityId);
    }

    getLayoutData(): TerminalManager.LayoutData {
        const pageItems: TerminalManager.TerminalManagerLayoutData = { pageLayouts: [] };
        const fullLayoutData: TerminalManager.LayoutData = {
            type: 'terminal-manager',
            items: pageItems,
            widget: this.treeWidget,
            terminalAndTreeRelativeSizes: this.pageAndTreeLayout?.relativeSizes(),
        };
        const treeRoot = this.treeWidget.model.root;
        if (treeRoot && CompositeTreeNode.is(treeRoot)) {
            const pageNodes = treeRoot.children;
            for (const pageNode of pageNodes) {
                if (TerminalManagerTreeTypes.isPageNode(pageNode)) {
                    const groupNodes = pageNode.children;
                    const pagePanel = this.pagePanels.get(pageNode.id);
                    const pageLayoutData: TerminalManager.PageLayoutData = {
                        groupLayouts: [],
                        label: pageNode.label,
                        groupRelativeWidths: pagePanel?.relativeSizes(),
                    };
                    for (let groupIndex = 0; groupIndex < groupNodes.length; groupIndex++) {
                        const groupNode = groupNodes[groupIndex];
                        const groupPanel = this.groupPanels.get(groupNode.id);
                        if (TerminalManagerTreeTypes.isTerminalGroupNode(groupNode)) {
                            const groupLayoutData: TerminalManager.TerminalGroupLayoutData = {
                                label: groupNode.label,
                                widgetLayouts: [],
                                widgetRelativeHeights: groupPanel?.relativeSizes(),
                            };
                            const widgetNodes = groupNode.children;
                            for (let widgetIndex = 0; widgetIndex < widgetNodes.length; widgetIndex++) {
                                const widgetNode = widgetNodes[widgetIndex];
                                if (TerminalManagerTreeTypes.isTerminalNode(widgetNode)) {
                                    const widget = this.terminalWidgets.get(widgetNode.id as TerminalManagerTreeTypes.TerminalId);
                                    const terminalLayoutData: TerminalManager.TerminalWidgetLayoutData = {
                                        widget,
                                    };
                                    groupLayoutData.widgetLayouts.push(terminalLayoutData);
                                }
                            }
                            pageLayoutData.groupLayouts.push(groupLayoutData);
                        }
                    }
                    pageItems.pageLayouts.push(pageLayoutData);
                }
            }
        }
        console.log('SENTINEL LAYOUT', fullLayoutData);
        return fullLayoutData;

        // return this.treeWidget.model.getLayoutData();
        // // let layoutData = this.treeWidget.model.getLayoutData();
        // // const pageAndPanelRelativeSizes = this.pageAndTreeLayout?.relativeSizes();
        // // // layoutData = { ...layoutData, pageWidth, treeWidth, treeWidget: this.treeWidget };
        // // layoutData = { ...layoutData, terminalAndTreeRelativeSizes: pageAndPanelRelativeSizes };
        // // return layoutData;
    }

    setLayoutData(layoutData: TerminalManager.LayoutData): void {
        console.log('SENTINEL LAYOUT DATA', layoutData);
        // const { items, terminalAndTreeRelativeSizes, } = layoutData;
        // if (pageAndPanelRelativeSizes) {
        //     this.pageAndTreeLayout?.setRelativeSizes(pageAndPanelRelativeSizes);
        // } else {
        //     this.pageAndTreeLayout?.setPartSizes([60, 15]);
        // }
        // const pageLayouts = items?.pageLayouts;
        // if (pageLayouts) {
        //     for (let pageIndex = 0; pageIndex < pageLayouts.length; pageIndex++) {
        //         const pageLayout = pageLayouts[pageIndex];
        //         const pagePanel = this.createPagePanel();
        //         this.terminalPanelWrapper.addWidget(pagePanel);
        //         const { groupLayouts, groupRelativeWidths } = pageLayout;
        //         for (let groupIndex = 0; groupIndex < groupLayouts.length; groupIndex++) {
        //             const groupLayout = groupLayouts[groupIndex];
        //             const groupPanel = this.createTerminalGroupPanel();
        //             pagePanel.id = `page-${groupPanel.id}`;
        //             pagePanel.addWidget(groupPanel);
        //             const { widgetLayouts, widgetRelativeHeights } = groupLayout;
        //             for (let widgetIndex = 0; widgetIndex < widgetLayouts.length; widgetIndex++) {
        //                 const widgetLayout = widgetLayouts[widgetIndex];
        //                 const { widget } = widgetLayout;
        //                 groupPanel.addWidget(widget);
        //             }
        //             groupPanel.setRelativeSizes(widgetRelativeHeights);
        //         }
        //         pagePanel.setRelativeSizes(groupRelativeWidths);
        //     }
        // }
        // const treeWidget = layoutData.treeWidget;
        this.layoutWasRestored = true;
    }
}
