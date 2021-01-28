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
import { injectable, interfaces, Container } from 'inversify';
import { createFileTreeContainer, FileTree, FileTreeModel, FileTreeWidget } from '@theia/filesystem/lib/browser';
import { defaultTreeProps, ReactWidget, Tree, TreeModel, TreeProps } from '@theia/core/lib/browser';
import { FileNavigatorModel } from '.';
import { OpenEditorsTree } from './navigator-open-editors-tree';

export const OPEN_EDITORS_PROPS: TreeProps = {
    ...defaultTreeProps,
    // contextMenuPath: NAVIGATOR_CONTEXT_MENU,
    multiSelect: true,
    search: true,
    globalSelection: true
};
@injectable()
export class OpenEditorsWidget extends ReactWidget {
    // export class OpenEditorsWidget extends FileTreeWidget {
    static ID = 'open-editors';
    static LABEL = 'Open Editors';

    static createContainer(parent: interfaces.Container): Container {
        // const child = createFileTreeContainer(parent);
        const child = new Container({ defaultScope: 'Singleton' });
        child.parent = parent;
        child.bind(OpenEditorsWidget).toSelf();
        // child.unbind(FileTree);
        // child.bind(OpenEditorsTree).toSelf();
        // child.rebind(Tree).toService(OpenEditorsTree);

        // child.unbind(FileTreeModel);
        // child.bind(FileNavigatorModel).toSelf();
        // child.rebind(TreeModel).toService(FileNavigatorModel);

        // child.unbind(FileTreeWidget);
        // child.bind(OpenEditorsWidget).toSelf();

        // child.rebind(TreeProps).toConstantValue(OPEN_EDITORS_PROPS);
        return child;
    }

    static createWidget(parent: interfaces.Container): OpenEditorsWidget {
        return OpenEditorsWidget.createContainer(parent).get(OpenEditorsWidget);
    }
    render(): React.ReactNode {
        return <div>WIDGET</div>
    }
}
