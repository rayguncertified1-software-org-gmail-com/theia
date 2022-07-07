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

import { Command, MenuPath } from '@theia/core';
import {
    ApplicationShell,
    SelectableTreeNode,
    CompositeTreeNode,
    SplitPanel,
    ApplicationShellLayoutVersion,
    DockPanel,
    SidePanel,
    codicon,
} from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';
import { TerminalManagerTreeWidget } from './terminal-manager-tree-widget';

export namespace TerminalManagerCommands {
    export const MANAGER_NEW_TERMINAL_TOOLBAR = Command.toDefaultLocalizedCommand({
        id: 'terminal:new-in-manager-toolbar',
        category: 'Terminal Manager',
        label: 'Create New Terminal Group',
        iconClass: codicon('split-horizontal'),
    });
    export const MANAGER_DELETE_TERMINAL = Command.toDefaultLocalizedCommand({
        id: 'terminal:delete-terminal',
        category: 'Terminal Manager',
        label: 'Delete Terminal',
        iconClass: codicon('trash'),
    });
    export const MANAGER_RENAME_TERMINAL = Command.toDefaultLocalizedCommand({
        id: 'terminal: rename-terminal',
        category: 'Terminal Manager',
        label: 'Rename...',
        iconClass: codicon('edit'),
    });
    export const MANAGER_NEW_PAGE_TOOLBAR = Command.toDefaultLocalizedCommand({
        id: 'terminal:new-manager-page',
        category: 'Terminal Manager',
        label: 'Create New Terminal Page',
        iconClass: codicon('new-file'),
    });
    export const MANAGER_DELETE_PAGE = Command.toDefaultLocalizedCommand({
        id: 'terminal:delete-page',
        category: 'Terminal Manager',
        label: 'Delete Page',
        iconClass: codicon('trash'),
    });
    export const MANAGER_SPLIT_TERMINAL_HORIZONTAL = Command.toDefaultLocalizedCommand({
        id: 'terminal:manager-split-horizontal',
        category: 'Terminal Manager',
        label: 'Split Active Terminal Vertically',
        iconClass: codicon('split-vertical'),
    });
    export const MANAGER_DELETE_GROUP = Command.toDefaultLocalizedCommand({
        id: 'terminal:manager-delete-group',
        category: 'Terminal Manager',
        label: 'Delete Group...',
        iconClass: codicon('trash'),
    });

    export const MANAGER_SHOW_TREE_TOOLBAR = Command.toDefaultLocalizedCommand({
        id: 'terminal:manager-toggle-tree',
        category: 'Terminal Manager',
        label: 'Toggle Tree View',
        iconClass: codicon('list-tree'),
    });
}

export namespace TerminalManager {
    export const TERMINAL_MANAGER_TREE_CONTEXT_MENU = ['terminal-manager-tree-context-menu'];

    export type Area = 'terminal-manager-current' | 'terminal-manager-new-page' | TerminalManagerTreeTypes.TerminalId;
    export const isTerminalManagerArea = (obj: unknown): obj is Area => typeof obj === 'string' && obj.startsWith('terminal');

    export interface ApplicationShellLayoutData extends ApplicationShell.LayoutData {
        version?: string | ApplicationShellLayoutVersion,
        mainPanel?: DockPanel.ILayoutConfig;
        mainPanelPinned?: boolean[];
        bottomPanel?: ApplicationShell.BottomPanelLayoutData;
        leftPanel?: SidePanel.LayoutData;
        rightPanel?: SidePanel.LayoutData;
        terminalManager?: TerminalManager.LayoutData;
        activeWidgetId?: string;
    }
    export interface TerminalWidgetLayoutData {
        widget: TerminalWidget | undefined;
    }

    export interface TerminalGroupLayoutData {
        widgetLayouts: TerminalWidgetLayoutData[];
        widgetRelativeHeights: number[] | undefined;
        id: TerminalManagerTreeTypes.GroupId;
    }

    export interface PageLayoutData {
        groupLayouts: TerminalGroupLayoutData[];
        groupRelativeWidths: number[] | undefined;
        id: TerminalManagerTreeTypes.PageId;
    }
    export interface TerminalManagerLayoutData {
        pageLayouts: PageLayoutData[];
    }
    export interface LayoutData {
        items?: TerminalManagerLayoutData;
        widget: TerminalManagerTreeWidget | undefined;
        terminalAndTreeRelativeSizes: number[] | undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export const isLayoutData = (obj: any): obj is LayoutData => typeof obj === 'object' && !!obj && 'type' in obj && obj.type === 'terminal-manager';

}
export namespace TerminalManagerTreeTypes {
    export type TerminalId = `terminal-${number}`;
    export const isTerminalID = (obj: unknown): obj is TerminalId => typeof obj === 'string' && obj.startsWith('terminal-');
    export interface TerminalNode extends SelectableTreeNode, CompositeTreeNode {
        terminal: true;
        isEditing: boolean;
        label: string;
    };

    export type GroupId = `group-${string}`;
    export const isGroupId = (obj: unknown): obj is GroupId => typeof obj === 'string' && obj.startsWith('group-');
    export interface GroupSplitPanel extends SplitPanel {
        id: GroupId;
    }
    export interface TerminalGroupNode extends SelectableTreeNode, CompositeTreeNode {
        terminalGroup: true;
        isEditing: boolean;
        label: string;
        id: GroupId;
    };

    export type PageId = `page-${string}`;
    export const isPageId = (obj: unknown): obj is PageId => typeof obj === 'string' && obj.startsWith('page-');
    export interface PageSplitPanel extends SplitPanel {
        id: PageId;
    }
    export interface PageNode extends SelectableTreeNode, CompositeTreeNode {
        page: true;
        children: Array<TerminalGroupNode>;
        isEditing: boolean;
        label: string;
        id: PageId;
    }

    export type TerminalManagerTreeNode = PageNode | TerminalNode | TerminalGroupNode;
    export type TerminalManagerValidId = PageId | TerminalId | GroupId;
    export const isPageNode = (obj: unknown): obj is PageNode => !!obj && typeof obj === 'object' && 'page' in obj;
    export const isTerminalNode = (obj: unknown): obj is TerminalNode => !!obj && typeof obj === 'object' && 'terminal' in obj;
    export const isTerminalGroupNode = (obj: unknown): obj is TerminalGroupNode => !!obj && typeof obj === 'object' && 'terminalGroup' in obj;
    export const isTerminalManagerTreeNode = (obj: unknown): obj is (PageNode | TerminalNode) => isPageNode(obj) || isTerminalNode(obj) || isTerminalGroupNode(obj);
    export interface SelectionChangedEvent {
        activePageId: PageId | undefined;
        activeTerminalId: TerminalId | undefined;
        activeGroupId: GroupId | undefined;
    }

    export const TerminalContextMenuID = 'terminal-manager-tree';
    export type ContextMenuArgs = [typeof TerminalContextMenuID, TerminalManagerValidId];
    export const toContextMenuArgs = (node: TerminalManagerTreeNode): ContextMenuArgs => ([TerminalContextMenuID, node.id as TerminalManagerValidId]);

    export const PAGE_NODE_MENU: MenuPath = ['terminal-manager-page-node'];
    export const GROUP_NODE_MENU: MenuPath = ['terminal-manager-group-node'];
    export const TERMINAL_NODE_MENU: MenuPath = ['terminal-manager-terminal-node'];

    export interface InlineActionProps {
        commandId: string;
        iconClass: string;
        tooltip: string;
    }

}
