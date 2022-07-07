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
import { Command, CommandRegistry, MenuModelRegistry } from '@theia/core';
import { TerminalManager, TerminalManagerCommands, TerminalManagerTreeTypes } from './terminal-manager-types';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { TerminalFrontendContribution } from './terminal-frontend-contribution';
import { UUID } from '@theia/core/shared/@phosphor/coreutils';

const GET_SIZES: Command = {
    id: 'terminal-manager-get-layout',
    label: 'TerminalManager: Get Layout Data',
};

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
        commands.registerCommand(GET_SIZES, {
            execute: () => this.tryGetWidget()?.getLayoutData(),
        });

        commands.registerCommand(TerminalManagerCommands.MANAGER_NEW_TERMINAL_TOOLBAR, {
            execute: () => this.openInManager('terminal-manager-current'),
            isVisible: (
                widgetOrID: Widget | string,
                node?: TerminalManagerTreeTypes.TerminalManagerTreeNode,
            ) => widgetOrID instanceof TerminalManagerWidget || (widgetOrID === 'terminal-manager-tree' && TerminalManagerTreeTypes.isPageNode(node)),
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_SHOW_TREE_TOOLBAR, {
            execute: () => this.handleToggleTree(),
            isVisible: widget => widget instanceof TerminalManagerWidget,
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_NEW_PAGE_TOOLBAR, {
            execute: () => this.openInManager('terminal-manager-new-page'),
            isVisible: widget => widget instanceof TerminalManagerWidget,
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_DELETE_TERMINAL, {
            execute: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => TerminalManagerTreeTypes.isTerminalID(args[1]) && this.deleteTerminalFromManager(args[1]),
            isVisible: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => args[0] === 'terminal-manager-tree' && TerminalManagerTreeTypes.isTerminalNode(args[1]),
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_DELETE_PAGE, {
            execute: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => TerminalManagerTreeTypes.isPageId(args[1]) && this.deletePageFromManager(args[1]),
            isVisible: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => args[0] === 'terminal-manager-tree' && TerminalManagerTreeTypes.isPageNode(args[1]),
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_RENAME_TERMINAL, {
            execute: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => this.toggleRenameTerminalFromManager(args[1]),
            isVisible: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => args[0] === 'terminal-manager-tree',
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_SPLIT_TERMINAL_HORIZONTAL, {
            execute: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => {
                const id = args[1];
                if (TerminalManagerTreeTypes.isTerminalID(id)) {
                    this.openInManager(id);
                }
            },
            isVisible: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => args[0] === 'terminal-manager-tree' && TerminalManagerTreeTypes.isTerminalNode(args[1]),
        });
        commands.registerCommand(TerminalManagerCommands.MANAGER_DELETE_GROUP, {
            execute: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => TerminalManagerTreeTypes.isGroupId(args[1]) && this.deleteGroupFromManager(args[1]),
            isVisible: (...args: TerminalManagerTreeTypes.ContextMenuArgs) => 'terminal-manager-tree' && TerminalManagerTreeTypes.isTerminalGroupNode(args[1]),
        });
    }

    async openInManager(area: TerminalManager.Area): Promise<void> {
        const terminalManagerWidget = await this.widget;
        this.openView({ activate: true }).then(widget => widget.setPanelSizes());
        const terminalWidget = await this.terminalFrontendContribution.newTerminal({});
        Object.assign(terminalWidget, { uuid: `terminal-${UUID.uuid4()}` });
        terminalWidget.start();
        if (area && terminalManagerWidget) {
            if (area === 'terminal-manager-current') {
                terminalManagerWidget.addTerminalGroupToPage(terminalWidget);
            } else if (area === 'terminal-manager-new-page') {
                terminalManagerWidget.addTerminalPage(terminalWidget);
            } else if (TerminalManagerTreeTypes.isTerminalID(area)) {
                terminalManagerWidget.addWidgetToTerminalGroup(terminalWidget, area);
            }
        }
    }

    protected async handleToggleTree(): Promise<void> {
        const terminalManagerWidget = await this.widget;
        terminalManagerWidget.toggleTreeVisibility();

    }

    protected deleteTerminalFromManager(terminalId: TerminalManagerTreeTypes.TerminalId): void {
        const terminalManagerWidget = this.tryGetWidget();
        terminalManagerWidget?.deleteTerminal(terminalId);
    }

    protected deleteGroupFromManager(groupId: TerminalManagerTreeTypes.GroupId): void {
        const terminalManagerWidget = this.tryGetWidget();
        terminalManagerWidget?.deleteGroup(groupId);
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
            commandId: TerminalManagerCommands.MANAGER_SPLIT_TERMINAL_HORIZONTAL.id,
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
            commandId: TerminalManagerCommands.MANAGER_NEW_TERMINAL_TOOLBAR.id,
            order: 'a',
        });
        menus.registerMenuAction(TerminalManagerTreeTypes.PAGE_NODE_MENU, {
            commandId: TerminalManagerCommands.MANAGER_DELETE_PAGE.id,
            order: 'c'
        });

        menus.registerMenuAction(TerminalManagerTreeTypes.TERMINAL_NODE_MENU, {
            commandId: TerminalManagerCommands.MANAGER_DELETE_TERMINAL.id,
            order: 'c'
        });
        menus.registerMenuAction(TerminalManagerTreeTypes.TERMINAL_NODE_MENU, {
            commandId: TerminalManagerCommands.MANAGER_SPLIT_TERMINAL_HORIZONTAL.id,
            order: 'b'
        });
        menus.registerMenuAction(TerminalManagerTreeTypes.GROUP_NODE_MENU, {
            commandId: TerminalManagerCommands.MANAGER_DELETE_GROUP.id,
            order: 'c',
        });
    }

    registerToolbarItems(toolbar: TabBarToolbarRegistry): void {
        toolbar.registerItem({
            id: TerminalManagerCommands.MANAGER_NEW_TERMINAL_TOOLBAR.id,
            command: TerminalManagerCommands.MANAGER_NEW_TERMINAL_TOOLBAR.id,
            tooltip: TerminalManagerCommands.MANAGER_NEW_TERMINAL_TOOLBAR.label,
        });
        toolbar.registerItem({
            id: TerminalManagerCommands.MANAGER_NEW_PAGE_TOOLBAR.id,
            command: TerminalManagerCommands.MANAGER_NEW_PAGE_TOOLBAR.id,
        });
        toolbar.registerItem({
            id: TerminalManagerCommands.MANAGER_SHOW_TREE_TOOLBAR.id,
            command: TerminalManagerCommands.MANAGER_SHOW_TREE_TOOLBAR.id,
        });
    }
}
