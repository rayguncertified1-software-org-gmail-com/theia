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
import { ApplicationShell, WidgetOpenerOptions, SelectableTreeNode, CompositeTreeNode, SplitPanel } from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';

export namespace TerminalManager {
    export type TerminalID = `terminal-${number}`;
    export const isTerminalID = (obj: unknown): obj is TerminalID => typeof obj === 'string' && obj.startsWith('terminal-');
    export type Area = ApplicationShell.Area | 'terminal-manager-current' | 'terminal-manager-new-page' | TerminalID;
    export const isTerminalManagerArea = (obj: unknown): obj is Area => typeof obj === 'string' && obj.startsWith('terminal');
    export type ExtendedWidgetOptions = Omit<ApplicationShell.WidgetOptions, 'area'> & { area?: Area };
    export type ExtendedWidgetOpenerOptions = Omit<WidgetOpenerOptions, 'widgetOptions'> & { widgetOptions?: ExtendedWidgetOptions };
}
export namespace TerminalManagerTreeTypes {
    export interface TerminalNode extends SelectableTreeNode, CompositeTreeNode {
        terminal: true;
        widget: TerminalWidget;
        isEditing: boolean;
        label: string;
    };

    export interface TerminalGroupNode extends SelectableTreeNode, CompositeTreeNode {
        terminalGroup: true;
        panel: SplitPanel;
        isEditing: boolean;
        label: string;
    };
    export interface PageNode extends SelectableTreeNode, CompositeTreeNode {
        page: true;
        children: Array<TerminalNode | TerminalGroupNode>;
        isEditing: boolean;
        label: string;
        panel: SplitPanel;
    }

    export type TerminalManagerTreeNode = PageNode | TerminalNode | TerminalGroupNode;
    export const isPageNode = (obj: unknown): obj is PageNode => !!obj && typeof obj === 'object' && 'page' in obj;
    export const isTerminalNode = (obj: unknown): obj is TerminalNode => !!obj && typeof obj === 'object' && 'terminal' in obj;
    export const isTerminalGroupNode = (obj: unknown): obj is TerminalGroupNode => !!obj && typeof obj === 'object' && 'terminalGroup' in obj;
    export const isTerminalManagerTreeNode = (obj: unknown): obj is (PageNode | TerminalNode) => isPageNode(obj) || isTerminalNode(obj) || isTerminalGroupNode(obj);
    export interface SelectionChangedEvent {
        activePage: PageNode | undefined;
        activeTerminal: TerminalNode | undefined;
        activeGroup: TerminalGroupNode | undefined;
    }

    export const TerminalContextMenuID = 'terminal-manager-tree';
    export type ContextMenuArgs = [typeof TerminalContextMenuID, TerminalManagerTreeNode];
    export const toContextMenuArgs = (node: TerminalManagerTreeNode): ContextMenuArgs => ([TerminalContextMenuID, node]);

    export const PAGE_NODE_MENU: MenuPath = ['terminal-manager-page-node'];
    export const GROUP_NODE_MENU: MenuPath = ['terminal-manager-group-node'];
    export const TERMINAL_NODE_MENU: MenuPath = ['terminal-manager-terminal-node'];

    export interface InlineActionProps {
        commandId: string;
        iconClass: string;
        tooltip: string;
    }
}
