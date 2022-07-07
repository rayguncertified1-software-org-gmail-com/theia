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
    StatefulWidget,
    ViewContainerLayout,
    Widget,
    WidgetManager,
} from '@theia/core/lib/browser';
import { TerminalManagerTreeWidget } from './terminal-manager-tree-widget';
import { CommandService, Emitter } from '@theia/core';
import { UUID } from '@theia/core/shared/@phosphor/coreutils';
import { TerminalManager, TerminalManagerCommands, TerminalManagerTreeTypes } from './terminal-manager-types';
import { TerminalWidget } from './base/terminal-widget';
import { TerminalManagerPreferences } from './terminal-manager-preferences';

@injectable()
export class TerminalManagerWidget extends BaseWidget implements ApplicationShell.TrackableWidgetProvider, StatefulWidget {

    static ID = 'terminal-manager-widget';
    static LABEL = 'Terminal';

    static createContainer(parent: interfaces.Container): interfaces.Container {
        const child = parent.createChild();
        child.bind(TerminalManagerWidget).toSelf().inSingletonScope();
        return child;
    }

    static createWidget(parent: interfaces.Container): TerminalManagerWidget {
        return TerminalManagerWidget.createContainer(parent).get(TerminalManagerWidget);
    }

    @inject(SplitPositionHandler)
    protected readonly splitPositionHandler: SplitPositionHandler;

    protected treeWidget: TerminalManagerTreeWidget | undefined;
    @inject(DockPanelRendererFactory) protected dockPanelRendererFactory: () => DockPanelRenderer;
    @inject(ApplicationShell) protected readonly shell: ApplicationShell;
    @inject(CommandService) protected readonly commandService: CommandService;
    @inject(TerminalManagerPreferences) protected readonly terminalManagerPreferences: TerminalManagerPreferences;
    @inject(WidgetManager) protected readonly widgetManager: WidgetManager;

    protected activePageId: TerminalManagerTreeTypes.PageId | undefined;
    protected activeTerminalId: TerminalManagerTreeTypes.TerminalId | undefined;
    override layout: PanelLayout;
    protected panel: SplitPanel;
    protected stateWasRestored = false;

    protected pageAndTreeLayout: ViewContainerLayout | undefined;
    protected layoutWasRestored = false;

    protected pagePanels = new Map<TerminalManagerTreeTypes.PageId, TerminalManagerTreeTypes.PageSplitPanel>();
    protected groupPanels = new Map<TerminalManagerTreeTypes.GroupId, TerminalManagerTreeTypes.GroupSplitPanel>();
    protected terminalWidgets = new Map<TerminalManagerTreeTypes.TerminalId, TerminalManagerTreeTypes.TerminalWidgetWithUUID>();

    protected readonly onDidChangeTrackableWidgetsEmitter = new Emitter<Widget[]>();
    readonly onDidChangeTrackableWidgets = this.onDidChangeTrackableWidgetsEmitter.event;

    // serves as an empty container so that different view containers can be swapped out
    protected terminalPanelWrapper = new Panel({
        layout: new PanelLayout(),
    });

    @postConstruct()
    protected async init(): Promise<void> {
        this.title.iconClass = codicon('terminal-tmux');
        this.id = TerminalManagerWidget.ID;
        this.title.closable = true;
        this.title.label = TerminalManagerWidget.LABEL;
        await this.terminalManagerPreferences.ready;
        return this.initializeLayout();
    }

    async initializeLayout(): Promise<void> {
        console.log('SENTINEL TERMINAL MANAGER WIDGET INITIALIZELAYOUT');
        this.treeWidget = this.treeWidget ?? await this.widgetManager.getOrCreateWidget<TerminalManagerTreeWidget>(TerminalManagerTreeWidget.ID);
        this.registerListeners();
        if (!this.stateWasRestored) {
            this.createPageAndTreeLayout();
            await this.commandService.executeCommand(TerminalManagerCommands.MANAGER_NEW_PAGE_TOOLBAR.id);
        }
        this.onDidChangeTrackableWidgetsEmitter.fire(this.getTrackableWidgets());
    }

    protected registerListeners(): void {
        if (this.treeWidget) {
            this.toDispose.push(this.treeWidget);
            this.toDispose.push(this.treeWidget.model.onTreeSelectionChanged(changeEvent => this.handleSelectionChange(changeEvent)));

            this.toDispose.push(this.treeWidget.model.onPageAdded(pageId => this.handlePageAdded(pageId)));
            this.toDispose.push(this.treeWidget.model.onPageDeleted(pageId => this.handlePageDeleted(pageId)));

            this.toDispose.push(this.treeWidget.model.onTerminalGroupAdded(groupId => this.handleTerminalGroupAdded(groupId)));
            this.toDispose.push(this.treeWidget.model.onTerminalGroupDeleted(groupId => this.handleTerminalGroupDeleted(groupId)));

            this.toDispose.push(this.treeWidget.model.onTerminalAddedToGroup(({ terminalId, groupId }) => this.handleWidgetAddedToTerminalGroup(terminalId, groupId)));
            this.toDispose.push(this.treeWidget.model.onTerminalDeletedFromGroup(({ terminalId, groupId: groupId }) => this.handleTerminalDeleted(terminalId, groupId)));
        }

        this.toDispose.push(this.shell.onDidChangeActiveWidget(({ newValue }) => this.handleOnDidChangeActiveWidget(newValue)));

        this.toDispose.push(this.terminalManagerPreferences.onPreferenceChanged(() => this.resolveMainLayout()));
    }

    setPanelSizes(relativeSizes?: number[]): void {
        let panelSizes: number[] = [.2, .6];
        const treeViewLocation = this.terminalManagerPreferences.get('terminalManager.treeViewLocation');
        if (relativeSizes) {
            panelSizes = relativeSizes;
        } else if (treeViewLocation === 'right') {
            panelSizes = [.6, .2];
        }
        setTimeout(() => this.pageAndTreeLayout?.setRelativeSizes(panelSizes));
    }

    getTrackableWidgets(): Widget[] {
        return this.treeWidget
            ? [this.treeWidget, ...Array.from(this.terminalWidgets.values())]
            : Array.from(this.terminalWidgets.values());
    }

    toggleTreeVisibility(): void {
        if (!this.treeWidget) {
            return;
        }
        const { isHidden } = this.treeWidget;
        if (isHidden) {
            this.treeWidget.show();
            this.setPanelSizes();
        } else {
            this.treeWidget.hide();
        }
    }

    protected createPageAndTreeLayout(relativeSizes?: number[]): void {
        this.layout = new PanelLayout();
        this.pageAndTreeLayout = new ViewContainerLayout({
            renderer: SplitPanel.defaultRenderer,
            orientation: 'horizontal',
            spacing: 2,
            headerSize: 0,
            animationDuration: 200
        }, this.splitPositionHandler);
        this.panel = this.panel ?? new SplitPanel({
            layout: this.pageAndTreeLayout,
        });

        this.layout.addWidget(this.panel);
        this.resolveMainLayout(relativeSizes);
        this.update();
    }

    protected resolveMainLayout(relativeSizes?: number[]): void {
        if (!this.treeWidget) {
            return;
        }
        const treeViewLocation = this.terminalManagerPreferences.get('terminalManager.treeViewLocation');
        this.pageAndTreeLayout?.removeWidget(this.treeWidget);
        this.pageAndTreeLayout?.removeWidget(this.terminalPanelWrapper);
        if (treeViewLocation === 'left') {
            this.pageAndTreeLayout?.addWidget(this.treeWidget);
        }
        this.pageAndTreeLayout?.addWidget(this.terminalPanelWrapper);
        if (treeViewLocation === 'right') {
            this.pageAndTreeLayout?.addWidget(this.treeWidget);
        }
        this.setPanelSizes(relativeSizes);
    }

    addTerminalPage(widget: Widget): void {
        if (!this.treeWidget) {
            return;
        }
        if (TerminalManagerTreeTypes.isTerminalWidgetWithUUI(widget)) {
            this.terminalWidgets.set(widget.uuid, widget);
            const groupPanel = this.createTerminalGroupPanel();
            groupPanel.addWidget(widget);
            const pagePanel = this.createPagePanel();
            pagePanel.addWidget(groupPanel);
            // const groupPanel = existingGroupPanel ?? this.createTerminalGroupPanel(widget);
            // const pagePanel = existingPagePanel ?? this.createPagePanel(groupPanel);
            return this.treeWidget.model.addTerminalPage(widget.uuid, groupPanel.id, pagePanel.id);
        }
    }

    protected createPagePanel(pageId?: TerminalManagerTreeTypes.PageId): TerminalManagerTreeTypes.PageSplitPanel {
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
        pagePanel.id = pageId ?? `page-${uuid}`;
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
        if (!this.treeWidget) {
            return;
        }
        if (TerminalManagerTreeTypes.isTerminalWidgetWithUUI(widget)) {
            const terminalId = widget.uuid;
            // const groupPanel = this.createTerminalGroupPanel(widget);
            this.terminalWidgets.set(terminalId, widget);
            const groupPanel = this.createTerminalGroupPanel();
            groupPanel.addWidget(widget);
            this.treeWidget.model.addTerminalGroup(terminalId, groupPanel.id);
        }
    }

    protected createTerminalGroupPanel(groupId?: TerminalManagerTreeTypes.GroupId): TerminalManagerTreeTypes.GroupSplitPanel {
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
        groupPanel.id = groupId ?? `group-${uuid}`;
        this.groupPanels.set(groupPanel.id, groupPanel);
        return groupPanel;
    }

    protected handleTerminalGroupAdded(groupId: TerminalManagerTreeTypes.GroupId): void {
        if (!this.treeWidget) {
            return;
        }
        const groupPanel = this.groupPanels.get(groupId);
        const activePagePanelId = this.treeWidget.model.activePageNode?.id;
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
        if (!this.treeWidget) {
            return;
        }
        if (TerminalManagerTreeTypes.isTerminalWidgetWithUUI(widget)) {
            const newTerminalId = widget.uuid;
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
        if (!this.treeWidget) {
            return;
        }
        if (!(TerminalManagerTreeTypes.isTerminalWidgetWithUUI(widget))) {
            return;
        }
        const node = this.treeWidget.model.getNode(widget.uuid);
        if (node && TerminalManagerTreeTypes.isTerminalNode(node)) {
            this.treeWidget.model.selectNode(node);
        }
    }

    protected handleSelectionChange(changeEvent: TerminalManagerTreeTypes.SelectionChangedEvent): void {
        if (!this.treeWidget) {
            return;
        }
        const { activePageId, activeTerminalId } = changeEvent;
        // const layout = (this.panel.layout as ViewContainerLayout);
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
        this.treeWidget?.model.deleteTerminalNode(terminalId);
    }

    deleteGroup(groupId: TerminalManagerTreeTypes.GroupId): void {
        this.treeWidget?.model.deleteTerminalGroup(groupId);
    }

    deletePage(pageNode: TerminalManagerTreeTypes.PageId): void {
        this.treeWidget?.model.deleteTerminalPage(pageNode);
    }

    toggleRenameTerminal(entityId: TerminalManagerTreeTypes.TerminalManagerValidId): void {
        this.treeWidget?.model.toggleRenameTerminal(entityId);
    }

    storeState(): TerminalManager.LayoutData {
        const layoutData = this.getLayoutData();
        console.log('SENTINEL LAYOUT DATA', layoutData);
        return layoutData;
    }
    restoreState(oldState: TerminalManager.LayoutData): void {
        console.log('SENTINEL TERMINAL MANAGER RESTORE STATE');
        const { items, widget, terminalAndTreeRelativeSizes } = oldState;
        if (widget && terminalAndTreeRelativeSizes && items) {
            this.treeWidget = widget;
            this.createPageAndTreeLayout(terminalAndTreeRelativeSizes);
            try {
                this.restoreLayoutData(items, widget);
                this.stateWasRestored = true;
            } catch (e) {
                console.error(e);
                this.pagePanels = new Map();
                this.groupPanels = new Map();
                this.terminalWidgets = new Map();
                this.stateWasRestored = false;
            }
        }
        // console.log('SENTINEL RESTORE STATE BEING CALLED ON TERMINAL MANAGER WIDGET');
        // this.treeWidget = oldState.widget;
        // // console.log('SENTINEL OLD STATE', oldState);
    }

    restoreLayoutData(items: TerminalManager.TerminalManagerLayoutData, treeWidget: TerminalManagerTreeWidget): void {
        const createError = (nodeId: string): Error => new Error(`Terminal manager widget state could not be restored, mismatch in restored data for ${nodeId}`);

        const { pageLayouts } = items;
        for (const pageLayout of pageLayouts) {
            const pageId = pageLayout.id;

            const pagePanel = this.createPagePanel(pageId);
            const pageNode = treeWidget.model.getNode(pageId);
            if (!TerminalManagerTreeTypes.isPageNode(pageNode)) {
                throw createError(pageId);
            }
            this.pagePanels.set(pageId, pagePanel);
            this.terminalPanelWrapper.addWidget(pagePanel);
            const { groupLayouts } = pageLayout;
            const groupPanels: SplitPanel[] = [];
            for (const groupLayout of groupLayouts) {
                const { widgetLayouts } = groupLayout;
                const groupId = groupLayout.id;
                const groupPanel = this.createTerminalGroupPanel(groupId);
                const groupNode = treeWidget.model.getNode(groupId);
                if (!TerminalManagerTreeTypes.isTerminalGroupNode(groupNode)) {
                    throw createError(groupId);
                }
                this.groupPanels.set(groupId, groupPanel);
                groupPanels.push(groupPanel);
                // pagePanel.addWidget(groupPanel);
                const terminalWidgets: TerminalWidget[] = [];
                for (const widgetLayout of widgetLayouts) {
                    const { widget } = widgetLayout;
                    if (TerminalManagerTreeTypes.isTerminalWidgetWithUUI(widget)) {
                        const widgetId = widget.uuid;
                        const widgetNode = treeWidget.model.getNode(widgetId);
                        if (!TerminalManagerTreeTypes.isTerminalNode(widgetNode)) {
                            throw createError(widgetId);
                        }
                        this.terminalWidgets.set(widgetId, widget);
                        terminalWidgets.unshift(widget);
                    }
                }
                terminalWidgets.forEach(widget => groupPanel.addWidget(widget));
                const { widgetRelativeHeights } = groupLayout;
                if (widgetRelativeHeights) {
                    setTimeout(() => groupPanel.setRelativeSizes(widgetRelativeHeights));
                }
            }
            groupPanels.forEach(panel => pagePanel.addWidget(panel));
            const { groupRelativeWidths } = pageLayout;
            if (groupRelativeWidths) {
                setTimeout(() => pagePanel.setRelativeSizes(groupRelativeWidths));
            }
        }
        this.onDidChangeTrackableWidgetsEmitter.fire(this.getTrackableWidgets());
        this.update();
    }

    getLayoutData(): TerminalManager.LayoutData {
        const pageItems: TerminalManager.TerminalManagerLayoutData = { pageLayouts: [] };
        const fullLayoutData: TerminalManager.LayoutData = {
            widget: this.treeWidget,
            items: pageItems,
            terminalAndTreeRelativeSizes: this.pageAndTreeLayout?.relativeSizes(),
        };
        const treeRoot = this.treeWidget?.model.root;
        if (treeRoot && CompositeTreeNode.is(treeRoot)) {
            const pageNodes = treeRoot.children;
            for (const pageNode of pageNodes) {
                if (TerminalManagerTreeTypes.isPageNode(pageNode)) {
                    const groupNodes = pageNode.children;
                    const pagePanel = this.pagePanels.get(pageNode.id);
                    const pageLayoutData: TerminalManager.PageLayoutData = {
                        groupLayouts: [],
                        id: pageNode.id,
                        groupRelativeWidths: pagePanel?.relativeSizes(),
                    };
                    for (let groupIndex = 0; groupIndex < groupNodes.length; groupIndex++) {
                        const groupNode = groupNodes[groupIndex];
                        const groupPanel = this.groupPanels.get(groupNode.id);
                        if (TerminalManagerTreeTypes.isTerminalGroupNode(groupNode)) {
                            const groupLayoutData: TerminalManager.TerminalGroupLayoutData = {
                                id: groupNode.id,
                                widgetLayouts: [],
                                widgetRelativeHeights: groupPanel?.relativeSizes(),
                            };
                            const widgetNodes = groupNode.children;
                            for (let widgetIndex = 0; widgetIndex < widgetNodes.length; widgetIndex++) {
                                const widgetNode = widgetNodes[widgetIndex];
                                if (TerminalManagerTreeTypes.isTerminalNode(widgetNode)) {
                                    const widget = this.terminalWidgets.get(widgetNode.id);
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
        return fullLayoutData;
    }
}
