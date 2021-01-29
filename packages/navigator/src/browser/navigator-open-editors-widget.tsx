/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import * as React from 'react';
import { injectable, interfaces, Container, postConstruct } from 'inversify';
import { createFileTreeContainer, FileTree, FileTreeModel, FileTreeWidget } from '@theia/filesystem/lib/browser';
import { createTreeContainer, defaultTreeProps, ReactWidget, Tree, TreeModel, TreeProps, TreeWidget } from '@theia/core/lib/browser';
import { FileNavigatorModel } from '.';
import { OpenEditorsTree } from './navigator-open-editors-tree';
import { OpenEditorsModel } from './navigator-open-editors-tree-model';

export const OPEN_EDITORS_PROPS: TreeProps = {
    ...defaultTreeProps,
    // contextMenuPath: NAVIGATOR_CONTEXT_MENU,
    multiSelect: true,
    search: true,
    globalSelection: true
};
@injectable()
// export class OpenEditorsWidget extends ReactWidget {
export class OpenEditorsWidget extends TreeWidget {
    static ID = 'open-editors';
    static LABEL = 'Open Editors';

    static createContainer(parent: interfaces.Container): Container {
        // const child = createFileTreeContainer(parent);
        const child = createTreeContainer(parent);

        child.unbind(TreeWidget);
        child.bind(OpenEditorsWidget).toSelf();

        child.bind(OpenEditorsModel).toSelf();
        child.rebind(TreeModel).toService(OpenEditorsModel);
        // child.rebind(TreeModel);
        // child.unbind(FileTreeModel);
        // child.rebind(TreeModel).toService(OpenEditorsModel);
        child.rebind(TreeProps).toConstantValue(OPEN_EDITORS_PROPS);
        // keep filetree
        // keep filetreemodel
        // child.unbind(FileTree);
        // child.bind(OpenEditorsTree).toSelf();
        // child.rebind(Tree).toService(OpenEditorsTree);

        // child.bind(OpenEditorsWidget).toSelf();

        return child;
    }

    static createWidget(parent: interfaces.Container): OpenEditorsWidget {
        return OpenEditorsWidget.createContainer(parent).get(OpenEditorsWidget);
    }

    @postConstruct()
    init(): void {
        super.init();
        this.id = OpenEditorsWidget.ID;
        this.title.label = OpenEditorsWidget.LABEL;
        this.addClass(OpenEditorsWidget.ID);
        this.update();
    }
}
