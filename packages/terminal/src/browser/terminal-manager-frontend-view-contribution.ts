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

import { injectable, inject } from '@theia/core/shared/inversify';
import { AbstractViewContribution, FrontendApplication, FrontendApplicationContribution, Widget } from '@theia/core/lib/browser';
import { TerminalManagerWidget } from './terminal-manager-widget';
import { CommandRegistry, MenuModelRegistry } from '@theia/core';
import { TerminalManager, TerminalManagerCommands, TerminalManagerTreeTypes } from './terminal-manager-types';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { TerminalFrontendContribution } from './terminal-frontend-contribution';
import { TerminalWidget } from './base/terminal-widget';

@injectable()
export class TerminalManagerFrontendViewContribution extends AbstractViewContribution<TerminalManagerWidget>
    implements FrontendApplicationContribution, TabBarToolbarContribution {

    @inject(TerminalFrontendContribution) protected terminalFrontendContribution: TerminalFrontendContribution;
    constructor() {
        super({
            widgetId: TerminalManagerWidget.ID,
            widgetName: 'Terminal Manager',
            toggleCommandId: 'terminalManager:toggle',
            defaultWidgetOptions: {
                area: 'bottom'
            }
        });
    }

    async initializeLayout(app: FrontendApplication): Promise<void> {
        await this.openView();
        // return widget.initializeLayout();
    }

    override registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand(TerminalManagerCommands.MANAGER_NEW_TERMINAL_GROUP, {
            execute: (
                _id: string,
                pageId: TerminalManagerTreeTypes.PageId,
            ) => this.createNewTerminalGroup(pageId),
            isVisible: (
                id: string,
                nodeId?: TerminalManagerTreeTypes.TerminalManagerValidId,
            ) => (id === 'terminal-manager-tree' && TerminalManagerTreeTypes.isPageId(nodeId)),
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_SHOW_TREE_TOOLBAR, {
            execute: () => this.handleToggleTree(),
            isVisible: widget => widget instanceof TerminalManagerWidget,
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_NEW_PAGE_BOTTOM_TOOLBAR, {
            execute: () => this.createNewTerminalPage(),
            isVisible: (
                widgetOrID: Widget | string,
                nodeId?: TerminalManagerTreeTypes.TerminalManagerValidId,
            ) => widgetOrID instanceof TerminalManagerWidget || (widgetOrID === 'terminal-manager-tree' && TerminalManagerTreeTypes.isPageId(nodeId)),
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_DELETE_TERMINAL, {
            execute: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => TerminalManagerTreeTypes.isTerminalKey(args[1]) && this.deleteTerminalFromManager(args[1]),
            isVisible: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => {
                const widget = this.tryGetWidget();
                const menuId = args[0];
                const nodeId = args[1];
                if (widget?.treeWidget && menuId === 'terminal-manager-tree' && TerminalManagerTreeTypes.isTerminalKey(nodeId)) {
                    const { model } = widget.treeWidget;
                    const terminalNode = model.getNode(nodeId);
                    if (!TerminalManagerTreeTypes.isTerminalNode(terminalNode)) {
                        return false;
                    }
                    const { parentGroupId } = terminalNode;
                    const groupNode = model.getNode(parentGroupId);
                    if (!TerminalManagerTreeTypes.isTerminalGroupNode(groupNode)) {
                        return false;
                    }
                    if (groupNode.children.length > 1) {
                        return true;
                    }
                }
                return false;
            },
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_DELETE_PAGE, {
            execute: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => TerminalManagerTreeTypes.isPageId(args[1]) && this.deletePageFromManager(args[1]),
            isVisible: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => {
                const widget = this.tryGetWidget();
                if (widget) {
                    return args[0] === 'terminal-manager-tree' && TerminalManagerTreeTypes.isPageId(args[1]) && widget.pagePanels.size > 1;
                }
                return false;
            },
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_RENAME_TERMINAL, {
            execute: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => this.toggleRenameTerminalFromManager(args[1]),
            isVisible: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => args[0] === 'terminal-manager-tree',
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_ADD_TERMINAL_TO_GROUP, {
            execute: (
                _id: string,
                nodeId: TerminalManagerTreeTypes.GroupId,
            ) => this.addTerminalToGroup(nodeId),
            isVisible: (
                id: string,
                nodeId: TerminalManagerTreeTypes.TerminalManagerValidId,
            ) => id === 'terminal-manager-tree' && TerminalManagerTreeTypes.isGroupId(nodeId),
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_DELETE_GROUP, {
            execute: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => TerminalManagerTreeTypes.isGroupId(args[1]) && this.deleteGroupFromManager(args[1]),
            isVisible: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => {
                const widget = this.tryGetWidget();
                const menuId = args[0];
                const groupId = args[1];
                if (widget?.treeWidget && menuId === 'terminal-manager-tree' && TerminalManagerTreeTypes.isGroupId(groupId)) {
                    const { model } = widget.treeWidget;
                    const groupNode = model.getNode(groupId);
                    if (!TerminalManagerTreeTypes.isTerminalGroupNode(groupNode)) {
                        return false;
                    }
                    const { parentPageId } = groupNode;
                    const pageNode = model.getNode(parentPageId);
                    if (!TerminalManagerTreeTypes.isPageNode(pageNode)) {
                        return false;
                    }
                    if (pageNode.children.length > 1) {
                        return true;
                    }
                }
                return false;
            }
        });
    }

    // async openInManager(area: TerminalManager.Area): Promise<void> {
    async openInManager(
        widgetOrID: Widget | TerminalManagerTreeTypes.GroupId,
        node?: TerminalManagerTreeTypes.TerminalManagerTreeNode,
    ): Promise<void> {
        // const { terminalWidget, terminalManagerWidget } = await this.createTerminalWidget();
        // if (area && terminalManagerWidget) {
        //     if (area === 'terminal-manager-current') {
        //         terminalManagerWidget.addTerminalGroupToPage(terminalWidget);
        //     } else if (TerminalManagerTreeTypes.isTerminalKey(area)) {
        //         terminalManagerWidget.addWidgetToTerminalGroup(terminalWidget, area);
        //     }
        // }
    }

    protected async createTerminalWidget(): Promise<{ terminalManagerWidget: TerminalManagerWidget, terminalWidget: TerminalWidget }> {
        this.openView({ activate: true }).then(widget => widget.setPanelSizes());
        const terminalManagerWidget = await this.widget;
        const terminalWidget = await this.terminalFrontendContribution.newTerminal({
            // use milliseconds as a unique ID
            created: new Date().getTime().toString(),
        });
        terminalWidget.start();
        return { terminalManagerWidget, terminalWidget };
    }

    protected async createNewTerminalPage(): Promise<void> {
        const { terminalManagerWidget, terminalWidget } = await this.createTerminalWidget();
        terminalManagerWidget.addTerminalPage(terminalWidget);
    }

    protected async createNewTerminalGroup(pageId: TerminalManagerTreeTypes.PageId): Promise<void> {
        const { terminalManagerWidget, terminalWidget } = await this.createTerminalWidget();
        terminalManagerWidget.addTerminalGroupToPage(terminalWidget, pageId);
    }

    protected async addTerminalToGroup(groupId: TerminalManagerTreeTypes.GroupId): Promise<void> {
        const { terminalManagerWidget, terminalWidget } = await this.createTerminalWidget();
        terminalManagerWidget.addWidgetToTerminalGroup(terminalWidget, groupId);
    }

    protected async handleToggleTree(): Promise<void> {
        const terminalManagerWidget = await this.widget;
        terminalManagerWidget.toggleTreeVisibility();

    }

    protected deleteTerminalFromManager(terminalId: TerminalManagerTreeTypes.TerminalKey): void {
        const terminalManagerWidget = this.tryGetWidget();
        terminalManagerWidget?.deleteTerminal(terminalId);
    }

    protected deleteGroupFromManager(groupId: TerminalManagerTreeTypes.GroupId): void {
        this.widget.then(widget => widget.deleteGroup(groupId));
    }

    protected deletePageFromManager(pageId: TerminalManagerTreeTypes.PageId): void {
        const terminalManagerWidget = this.tryGetWidget();
        terminalManagerWidget?.deletePage(pageId);
    }

    protected toggleRenameTerminalFromManager(entityId: TerminalManagerTreeTypes.TerminalManagerValidId): void {
        const terminalManagerWidget = this.tryGetWidget();
        terminalManagerWidget?.toggleRenameTerminal(entityId);
    }

    override registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);
        menus.registerMenuAction(TerminalManager.TERMINAL_MANAGER_TREE_CONTEXT_MENU, {
            commandId: TerminalManagerCommands.MANAGER_ADD_TERMINAL_TO_GROUP.id,
            order: 'a',
        });
        menus.registerMenuAction(TerminalManager.TERMINAL_MANAGER_TREE_CONTEXT_MENU, {
            commandId: TerminalManagerCommands.MANAGER_RENAME_TERMINAL.id,
            order: 'b',
        });
        menus.registerMenuAction(TerminalManager.TERMINAL_MANAGER_TREE_CONTEXT_MENU, {
            commandId: TerminalManagerCommands.MANAGER_DELETE_TERMINAL.id,
            order: 'c',
        });
        menus.registerMenuAction(TerminalManager.TERMINAL_MANAGER_TREE_CONTEXT_MENU, {
            commandId: TerminalManagerCommands.MANAGER_DELETE_PAGE.id,
            order: 'c',
        });
        menus.registerMenuAction(TerminalManager.TERMINAL_MANAGER_TREE_CONTEXT_MENU, {
            commandId: TerminalManagerCommands.MANAGER_DELETE_GROUP.id,
            order: 'c',
        });

        menus.registerMenuAction(TerminalManagerTreeTypes.PAGE_NODE_MENU, {
            commandId: TerminalManagerCommands.MANAGER_NEW_PAGE_BOTTOM_TOOLBAR.id,
            order: 'a',
        });
        menus.registerMenuAction(TerminalManagerTreeTypes.PAGE_NODE_MENU, {
            commandId: TerminalManagerCommands.MANAGER_NEW_TERMINAL_GROUP.id,
            order: 'b',
        });
        menus.registerMenuAction(TerminalManagerTreeTypes.PAGE_NODE_MENU, {
            commandId: TerminalManagerCommands.MANAGER_DELETE_PAGE.id,
            order: 'c'
        });

        menus.registerMenuAction(TerminalManagerTreeTypes.TERMINAL_NODE_MENU, {
            commandId: TerminalManagerCommands.MANAGER_DELETE_TERMINAL.id,
            order: 'c'
        });

        menus.registerMenuAction(TerminalManagerTreeTypes.GROUP_NODE_MENU, {
            commandId: TerminalManagerCommands.MANAGER_ADD_TERMINAL_TO_GROUP.id,
            order: 'a'
        });
        menus.registerMenuAction(TerminalManagerTreeTypes.GROUP_NODE_MENU, {
            commandId: TerminalManagerCommands.MANAGER_DELETE_GROUP.id,
            order: 'c',
        });
    }

    registerToolbarItems(toolbar: TabBarToolbarRegistry): void {
        toolbar.registerItem({
            id: TerminalManagerCommands.MANAGER_NEW_PAGE_BOTTOM_TOOLBAR.id,
            command: TerminalManagerCommands.MANAGER_NEW_PAGE_BOTTOM_TOOLBAR.id,
        });
        toolbar.registerItem({
            id: TerminalManagerCommands.MANAGER_SHOW_TREE_TOOLBAR.id,
            command: TerminalManagerCommands.MANAGER_SHOW_TREE_TOOLBAR.id,
        });
    }
}
