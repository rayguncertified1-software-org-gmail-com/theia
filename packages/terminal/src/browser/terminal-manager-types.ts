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

import { MenuPath } from '@theia/core';
import {
    ApplicationShell,
    WidgetOpenerOptions,
    SelectableTreeNode,
    CompositeTreeNode,
    SplitPanel,
    ApplicationShellLayoutVersion,
    DockPanel,
    SidePanel,
} from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';
import { TerminalManagerTreeModel } from './terminal-manager-tree-model';

export namespace TerminalManager {

    export type Area = ApplicationShell.Area | 'terminal-manager-current' | 'terminal-manager-new-page' | TerminalManagerTreeTypes.TerminalId;
    export const isTerminalManagerArea = (obj: unknown): obj is Area => typeof obj === 'string' && obj.startsWith('terminal');
    export type ExtendedWidgetOptions = Omit<ApplicationShell.WidgetOptions, 'area'> & { area?: Area };
    export type ExtendedWidgetOpenerOptions = Omit<WidgetOpenerOptions, 'widgetOptions'> & { widgetOptions?: ExtendedWidgetOptions };

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
        widget: TerminalWidget;
    }

    export interface PageLayoutData {
        groupLayouts: TerminalGroupLayoutData[];
        groupRelativeWidths: number[];
        label: string;
    }
    export interface TerminalGroupLayoutData {
        widgetLayouts: TerminalWidgetLayoutData[];
        widgetRelativeHeights: number[];
        label: string;
    }
    export interface TerminalManagerLayoutData {
        pageLayouts: PageLayoutData[];
    }
    export interface LayoutData {
        type: 'terminal-manager',
        treeModel: TerminalManagerTreeModel
        // items?: TerminalManagerLayoutData;
        // treeModel?: TerminalManagerTreeModel;
        // terminalAndTreeRelativeSizes?: number[];
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
