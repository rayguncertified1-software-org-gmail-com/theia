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
    Message,
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
import { TerminalWidgetImpl } from './terminal-widget-impl';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';

@injectable()
export class TerminalManagerWidget extends BaseWidget implements StatefulWidget, ApplicationShell.TrackableWidgetProvider {

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

    treeWidget: TerminalManagerTreeWidget | undefined;
    @inject(DockPanelRendererFactory) protected dockPanelRendererFactory: () => DockPanelRenderer;
    @inject(ApplicationShell) protected readonly shell: ApplicationShell;
    @inject(CommandService) protected readonly commandService: CommandService;
    @inject(TerminalManagerPreferences) protected readonly terminalManagerPreferences: TerminalManagerPreferences;
    @inject(FrontendApplicationStateService) protected readonly applicationStateService: FrontendApplicationStateService;
    @inject(WidgetManager) protected readonly widgetManager: WidgetManager;

    protected activePageId: TerminalManagerTreeTypes.PageId | undefined;
    override layout: PanelLayout;
    protected panel: SplitPanel;
    protected stateWasRestored = false;

    protected pageAndTreeLayout: ViewContainerLayout | undefined;
    protected layoutWasRestored = false;

    pagePanels = new Map<TerminalManagerTreeTypes.PageId, TerminalManagerTreeTypes.PageSplitPanel>();
    groupPanels = new Map<TerminalManagerTreeTypes.GroupId, TerminalManagerTreeTypes.GroupSplitPanel>();
    terminalWidgets = new Map<TerminalManagerTreeTypes.TerminalKey, TerminalWidget>();

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
        this.node.tabIndex = 0;
        Object.assign(this.terminalPanelWrapper, { id: 'terminal-panel-wrapper' });
        await this.terminalManagerPreferences.ready;
        return this.initializeLayout();
    }

    async initializeLayout(): Promise<void> {
        this.treeWidget = this.treeWidget ?? await this.widgetManager.getOrCreateWidget<TerminalManagerTreeWidget>(TerminalManagerTreeWidget.ID);
        this.registerListeners();
        if (!this.stateWasRestored) {
            this.createPageAndTreeLayout();
            await this.commandService.executeCommand(TerminalManagerCommands.MANAGER_NEW_PAGE_BOTTOM_TOOLBAR.id);
        }
        this.onDidChangeTrackableWidgetsEmitter.fire(this.getTrackableWidgets());
    }

    protected registerListeners(): void {
        if (this.treeWidget) {
            this.toDispose.push(this.treeWidget);
            this.toDispose.push(this.treeWidget.model.onTreeSelectionChanged(changeEvent => this.handleSelectionChange(changeEvent)));

            this.toDispose.push(this.treeWidget.model.onPageAdded(({ pageId, terminalKey }) => this.handlePageAdded(pageId, terminalKey)));
            this.toDispose.push(this.treeWidget.model.onPageDeleted(pageId => this.handlePageDeleted(pageId)));

            this.toDispose.push(this.treeWidget.model.onTerminalGroupAdded(({ groupId, pageId, terminalKey }) => this.handleTerminalGroupAdded(groupId, pageId, terminalKey)));
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
        requestAnimationFrame(() => this.pageAndTreeLayout?.setRelativeSizes(panelSizes));
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
        Object.assign(this.panel, { id: 'page-and-tree-panel' });

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
        if (widget instanceof TerminalWidgetImpl) {
            const terminalKey = TerminalManagerTreeTypes.generateTerminalKey(widget);
            this.terminalWidgets.set(terminalKey, widget);
            this.onDidChangeTrackableWidgetsEmitter.fire(this.getTrackableWidgets());
            const groupPanel = this.createTerminalGroupPanel();
            groupPanel.addWidget(widget);
            const pagePanel = this.createPagePanel();
            pagePanel.addWidget(groupPanel);
            // const groupPanel = existingGroupPanel ?? this.createTerminalGroupPanel(widget);
            // const pagePanel = existingPagePanel ?? this.createPagePanel(groupPanel);
            return this.treeWidget.model.addTerminalPage(terminalKey, groupPanel.id, pagePanel.id);
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
        const idPrefix = 'page-';
        const uuid = this.generateUUIDAvoidDuplicatesFromStorage(idPrefix);
        pagePanel.node.tabIndex = -1;
        pagePanel.id = pageId ?? `${idPrefix}-${uuid}`;
        this.pagePanels.set(pagePanel.id, pagePanel);

        return pagePanel;
    }

    protected generateUUIDAvoidDuplicatesFromStorage(idPrefix: 'group-' | 'page-'): string {
        // highly unlikely there would ever be a duplicate, but just to be safe :)
        let didNotGenerateValidId = true;
        let uuid: string = '';
        while (didNotGenerateValidId) {
            uuid = UUID.uuid4();
            if (idPrefix === 'group-') {
                didNotGenerateValidId = this.groupPanels.has(`group-${uuid}`);
            } else if (idPrefix === 'page-') {
                didNotGenerateValidId = this.pagePanels.has(`page-${uuid}`);
            }
        }
        return uuid;
    }

    protected handlePageAdded(pageId: TerminalManagerTreeTypes.PageId, terminalKey: TerminalManagerTreeTypes.TerminalKey): void {
        const pagePanel = this.pagePanels.get(pageId);
        if (pagePanel) {
            (this.terminalPanelWrapper.layout as PanelLayout).addWidget(pagePanel);
            this.update();
            this.activateTerminalWidget(terminalKey);
        }
    }

    protected handlePageDeleted(pagePanelId: TerminalManagerTreeTypes.PageId): void {
        this.pagePanels.get(pagePanelId)?.dispose();
        this.pagePanels.delete(pagePanelId);
    }

    addTerminalGroupToPage(widget: Widget, pageId: TerminalManagerTreeTypes.PageId): void {
        if (!this.treeWidget) {
            return;
        }
        if (widget instanceof TerminalWidgetImpl) {
            const terminalId = TerminalManagerTreeTypes.generateTerminalKey(widget);
            // const groupPanel = this.createTerminalGroupPanel(widget);
            this.terminalWidgets.set(terminalId, widget);
            this.onDidChangeTrackableWidgetsEmitter.fire(this.getTrackableWidgets());
            const groupPanel = this.createTerminalGroupPanel();
            groupPanel.addWidget(widget);
            this.treeWidget.model.addTerminalGroup(terminalId, groupPanel.id, pageId);
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
        const idPrefix = 'group-';
        const uuid = this.generateUUIDAvoidDuplicatesFromStorage(idPrefix);
        groupPanel.node.tabIndex = -1;
        groupPanel.id = groupId ?? `${idPrefix}-${uuid}`;
        this.groupPanels.set(groupPanel.id, groupPanel);
        return groupPanel;
    }

    protected handleTerminalGroupAdded(
        groupId: TerminalManagerTreeTypes.GroupId,
        pageId: TerminalManagerTreeTypes.PageId,
        terminalKey: TerminalManagerTreeTypes.TerminalKey,
    ): void {
        if (!this.treeWidget) {
            return;
        }
        const groupPanel = this.groupPanels.get(groupId);
        if (!groupPanel) {
            return;
        }
        const activePage = this.pagePanels.get(pageId);
        if (activePage) {
            activePage.addWidget(groupPanel);
            this.update();
            this.activateTerminalWidget(terminalKey);
        }
    }

    protected async activateTerminalWidget(terminalKey: TerminalManagerTreeTypes.TerminalKey): Promise<Widget | undefined> {
        const terminalWidgetToActivate = this.terminalWidgets.get(terminalKey)?.id;
        if (terminalWidgetToActivate) {
            const activeWidgetFound = await this.shell.activateWidget(terminalWidgetToActivate);
            return activeWidgetFound;
        }
        return undefined;
    }

    activateWidget(id: string): Widget | undefined {
        const widget = Array.from(this.terminalWidgets.values()).find(terminalWidget => terminalWidget.id === id);
        console.log('SENTINEL FOUND WIDGET', widget);

        if (widget instanceof TerminalWidgetImpl) {
            widget.activate();
        }
        return widget;
        // const terminalWidget = this.revealWidget(id);
        // return this.revealWidget(id);
    }

    revealWidget(id: string): Widget | undefined {
        const activeTerminalKey = Array.from(this.terminalWidgets.keys()).find(terminalKey => this.terminalWidgets.get(terminalKey)?.id === id);
        if (activeTerminalKey) {
            const activePageId = this.treeWidget?.model.getPageIdForTerminal(activeTerminalKey);
            if (activePageId) {
                this.updateViewPage(activePageId);
            }
            return this.terminalWidgets.get(activeTerminalKey);
        }
    }

    protected handleTerminalGroupDeleted(groupPanelId: TerminalManagerTreeTypes.GroupId): void {
        this.groupPanels.get(groupPanelId)?.dispose();
        this.groupPanels.delete(groupPanelId);
    }

    addWidgetToTerminalGroup(widget: Widget, groupId: TerminalManagerTreeTypes.GroupId): void {
        if (!this.treeWidget) {
            return;
        }
        if (widget instanceof TerminalWidgetImpl) {
            const newTerminalId = TerminalManagerTreeTypes.generateTerminalKey(widget);
            this.terminalWidgets.set(newTerminalId, widget);
            this.onDidChangeTrackableWidgetsEmitter.fire(this.getTrackableWidgets());
            this.treeWidget.model.addTerminal(newTerminalId, groupId);
        }
    }

    protected override onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus();
    }

    protected handleWidgetAddedToTerminalGroup(terminalKey: TerminalManagerTreeTypes.TerminalKey, groupId: TerminalManagerTreeTypes.GroupId): void {
        const terminalWidget = this.terminalWidgets.get(terminalKey);
        const group = this.groupPanels.get(groupId);
        if (terminalWidget && group) {
            const groupPanel = this.groupPanels.get(groupId);
            groupPanel?.addWidget(terminalWidget);
            this.update();
            this.activateTerminalWidget(terminalKey);
            setTimeout(() => console.log('SENTINEL WIDGET IS ATTACHED AFTER SOME TIME', terminalWidget.isAttached), 1000);
        }
    }

    protected handleTerminalDeleted(terminalId: TerminalManagerTreeTypes.TerminalKey, groupPanelId: TerminalManagerTreeTypes.GroupId): void {
        const terminalWidget = this.terminalWidgets.get(terminalId);
        terminalWidget?.dispose();
        this.terminalWidgets.delete(terminalId);
        // const parentGroupPanel = this.groupPanels.get(groupPanelId);
        // if (parentGroupPanel && parentGroupPanel.widgets.length === 0) {
        //     this.deleteGroup(parentGroupPanel.id);
        // }
    }

    protected handleOnDidChangeActiveWidget(widget: Widget | null): void {
        if (!this.treeWidget) {
            return;
        }
        if (!(widget instanceof TerminalWidgetImpl)) {
            return;
        }
        const terminalKey = TerminalManagerTreeTypes.generateTerminalKey(widget);
        this.selectTerminalNode(terminalKey);
    }

    protected selectTerminalNode(terminalKey: TerminalManagerTreeTypes.TerminalKey): void {
        if (!this.treeWidget) {
            return;
        }
        const node = this.treeWidget.model.getNode(terminalKey);
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
        if (activePageId && activePageId) {
            const pageNode = this.treeWidget.model.getNode(activePageId);
            if (!TerminalManagerTreeTypes.isPageNode(pageNode)) {
                return;
            }
            this.title.label = `EMux: ${pageNode.label}`;
            this.updateViewPage(activePageId);
        }
        if (activeTerminalId && activeTerminalId) {
            this.flashActiveTerminal(activeTerminalId);
        }
        this.update();
    }

    protected flashActiveTerminal(terminalId: TerminalManagerTreeTypes.TerminalKey): void {
        const terminal = this.terminalWidgets.get(terminalId);
        terminal?.addClass('attention');
        setTimeout(() => terminal?.removeClass('attention'), 250);
    }

    protected updateViewPage(activePageId: TerminalManagerTreeTypes.PageId): void {
        // const activePanel = panel ?? this.pageNodeToPanelMap.get(activePage);
        const activePagePanel = this.pagePanels.get(activePageId);
        if (activePagePanel) {
            (this.terminalPanelWrapper.layout as PanelLayout).widgets.forEach(widget => this.terminalPanelWrapper.layout?.removeWidget(widget));
            (this.terminalPanelWrapper.layout as PanelLayout).addWidget(activePagePanel);
            this.update();
        }
    }

    deleteTerminal(terminalId: TerminalManagerTreeTypes.TerminalKey): void {
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
        return layoutData;
    }
    restoreState(oldState: TerminalManager.LayoutData): void {
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
                pagePanel.addWidget(groupPanel);
                for (const widgetLayout of widgetLayouts) {
                    const { widget } = widgetLayout;
                    if (widget instanceof TerminalWidgetImpl) {
                        const widgetId = TerminalManagerTreeTypes.generateTerminalKey(widget);
                        const widgetNode = treeWidget.model.getNode(widgetId);
                        if (!TerminalManagerTreeTypes.isTerminalNode(widgetNode)) {
                            throw createError(widgetId);
                        }
                        this.terminalWidgets.set(widgetId, widget);
                        this.onDidChangeTrackableWidgetsEmitter.fire(this.getTrackableWidgets());
                        groupPanel.addWidget(widget);
                        setTimeout(() => console.log('SENTINEL WIDGET IS ATTACHED DURING RESTORE', widget.isAttached), 1000);
                        requestAnimationFrame(() => this.shell.activateWidget(widget.id));
                    }
                }
                const { widgetRelativeHeights } = groupLayout;
                if (widgetRelativeHeights) {
                    requestAnimationFrame(() => groupPanel.setRelativeSizes(widgetRelativeHeights));
                }
            }
            groupPanels.forEach(panel => pagePanel.addWidget(panel));
            const { groupRelativeWidths } = pageLayout;
            if (groupRelativeWidths) {
                requestAnimationFrame(() => pagePanel.setRelativeSizes(groupRelativeWidths));
            }
        }
        this.onDidChangeTrackableWidgetsEmitter.fire(this.getTrackableWidgets());

        const { activeTerminalNode } = treeWidget.model;
        this.update();
        if (activeTerminalNode?.id) {
            this.applicationStateService.reachedState('ready').then(() => {
                this.selectTerminalNode(activeTerminalNode.id);
            });
        }
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
                            pageLayoutData.groupLayouts.unshift(groupLayoutData);
                        }
                    }
                    pageItems.pageLayouts.push(pageLayoutData);
                }
            }
        }
        return fullLayoutData;
    }
}
