import 'package:flutter/material.dart';
import 'package:hjsystems/api/models/model_estoque.dart';

class ViewProductScreen extends StatefulWidget {
  ModelEstoque product;
  ViewProductScreen({Key? key, required this.product}) : super(key: key);

  @override
  State<ViewProductScreen> createState() => _ViewProductScreenState();
}

class _ViewProductScreenState extends State<ViewProductScreen> {
  @override
  Widget build(BuildContext context) {
    const columns = [
      DataColumn(label: Text('Chave')),
      DataColumn(label: Text('Valor')),
    ];

    final dataRows = [
      DataRow(cells: [
        const DataCell(Text('Código')),
        DataCell(Text(widget.product.codigo!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('Nome')),
        DataCell(Text(widget.product.nome!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('Referência')),
        DataCell(Text(widget.product.referencia!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('G01')),
        DataCell(Text(widget.product.g01!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('G02')),
        DataCell(Text(widget.product.g02!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('G03')),
        DataCell(Text(widget.product.g03!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('G04')),
        DataCell(Text(widget.product.g04!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('G08')),
        DataCell(Text(widget.product.g08!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('GO')),
        DataCell(Text(widget.product.gO!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('G11')),
        DataCell(Text(widget.product.g11!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('G05')),
        DataCell(Text(widget.product.g05!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('G06')),
        DataCell(Text(widget.product.g06!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('G07')),
        DataCell(Text(widget.product.g07!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('G09')),
        DataCell(Text(widget.product.g09!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('G10')),
        DataCell(Text(widget.product.g10!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('DF')),
        DataCell(Text(widget.product.dF!)),
      ]),
      DataRow(cells: [
        const DataCell(Text('Geral')),
        DataCell(Text(widget.product.geral!)),
      ]),
    ];

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: Text(widget.product.nome!),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              buildInfoItemWithoutSpace('Código: ', widget.product.codigo!),
              buildInfoItemWithoutSpace('Nome: ', widget.product.nome!),
              buildInfoItemWithoutSpace('Referência: ', widget.product.referencia!),
              const Divider(),
              buildInfoItem('G01: ', widget.product.g01!),
              const Divider(),
              buildInfoItem('G02: ', widget.product.g02!),
              const Divider(),
              buildInfoItem('G03: ', widget.product.g03!),
              const Divider(),
              buildInfoItem('G04: ', widget.product.g04!),
              const Divider(),
              buildInfoItem('G08: ', widget.product.g08!),
              const Divider(),
              buildInfoItem('G011: ', widget.product.g11!),
              const Divider(),
              buildInfoItem('G012: ', widget.product.g12!),
              const Divider(),
              buildInfoItem('GO: ', widget.product.gO!),
              const Divider(),
              buildInfoItem('G05: ', widget.product.g05!),
              const Divider(),
              buildInfoItem('G06: ', widget.product.g06!),
              const Divider(),
              buildInfoItem('G07: ', widget.product.g07!),
              const Divider(),
              buildInfoItem('G09: ', widget.product.g09!),
              const Divider(),
              buildInfoItem('G10: ', widget.product.g10!),
              const Divider(),
              buildInfoItem('DF: ', widget.product.dF!),
              const Divider(),
              buildInfoItem('Geral: ', widget.product.geral!),
              const Divider(),
            ],
          ),
        ),
      ),
    );
  }

  Widget buildInfoItemWithoutSpace(String label, String value) {
    return Row(
      children: [
        Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
        ),
        const SizedBox(width: 10,),
        Flexible(
          child: Text(
            value,
            style: const TextStyle(fontSize: 20),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget buildInfoItem(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
        ),
        Flexible(
          child: Text(
            value,
            style: const TextStyle(fontSize: 20),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

}
